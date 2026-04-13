// wallet-monitor.js — polls watched wallets across multiple networks and fires
// an alert whenever a new outgoing transaction is detected. Single-tenant: reads
// the wallet list and contacts directly from config-store, no licenseKey indirection.
//
// Supported: Bitcoin (mempool), Solana, Tron, and 15 EVM chains via nonce diff.
// Poll interval: 30s. Initial poll seeds nonces without alerting (avoids firing
// on the very first start for wallets that already have historical activity).

var fs = require('fs');
var path = require('path');
var store = require('./config-store');
var alertService = require('./alert-dispatcher');

var SEEN_TX_PATH = path.join(__dirname, '../data/seen-txs.json');

var NETWORKS = {
  // Layer 1
  bitcoin: { name: 'Bitcoin', api: 'https://mempool.space/api/address/{ADDRESS}/txs/mempool', type: 'rest' },
  ethereum: { name: 'Ethereum', rpc: 'https://eth.llamarpc.com', type: 'evm' },
  solana: { name: 'Solana', rpc: 'https://api.mainnet-beta.solana.com', type: 'solana' },
  // Layer 2 / sidechains
  base: { name: 'Base', rpc: 'https://mainnet.base.org', type: 'evm' },
  polygon: { name: 'Polygon', rpc: 'https://polygon-rpc.com', type: 'evm' },
  arbitrum: { name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', type: 'evm' },
  optimism: { name: 'Optimism', rpc: 'https://mainnet.optimism.io', type: 'evm' },
  avalanche: { name: 'Avalanche C-Chain', rpc: 'https://api.avax.network/ext/bc/C/rpc', type: 'evm' },
  bsc: { name: 'BNB Smart Chain', rpc: 'https://bsc-dataseed.binance.org', type: 'evm' },
  fantom: { name: 'Fantom', rpc: 'https://rpc.ftm.tools', type: 'evm' },
  gnosis: { name: 'Gnosis (xDai)', rpc: 'https://rpc.gnosischain.com', type: 'evm' },
  zksync: { name: 'zkSync Era', rpc: 'https://mainnet.era.zksync.io', type: 'evm' },
  linea: { name: 'Linea', rpc: 'https://rpc.linea.build', type: 'evm' },
  scroll: { name: 'Scroll', rpc: 'https://rpc.scroll.io', type: 'evm' },
  celo: { name: 'Celo', rpc: 'https://forno.celo.org', type: 'evm' },
  mantle: { name: 'Mantle', rpc: 'https://rpc.mantle.xyz', type: 'evm' },
  blast: { name: 'Blast', rpc: 'https://rpc.blast.io', type: 'evm' },
  tron: { name: 'Tron', api: 'https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions?limit=1&only_from=true', type: 'tron' }
};

var POLL_INTERVAL = 30000;
var pollTimer = null;

function loadSeenTxs() {
  try {
    if (fs.existsSync(SEEN_TX_PATH)) return JSON.parse(fs.readFileSync(SEEN_TX_PATH, 'utf8'));
  } catch (e) {}
  return {};
}

function saveSeenTxs(data) {
  fs.mkdirSync(path.dirname(SEEN_TX_PATH), { recursive: true });
  fs.writeFileSync(SEEN_TX_PATH, JSON.stringify(data, null, 2));
}

async function checkBitcoin(address) {
  try {
    var url = NETWORKS.bitcoin.api.replace('{ADDRESS}', address);
    var resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return [];
    var txs = await resp.json();
    return txs.filter(function(tx) {
      return tx.vin && tx.vin.some(function(input) {
        return input.prevout && input.prevout.scriptpubkey_address === address;
      });
    }).map(function(tx) {
      return { txid: tx.txid, network: 'bitcoin' };
    });
  } catch (e) {
    return [];
  }
}

async function checkEVM(address, network) {
  try {
    var rpc = NETWORKS[network].rpc;
    var resp = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionCount',
        params: [address, 'pending']
      }),
      signal: AbortSignal.timeout(10000)
    });
    var data = await resp.json();
    var nonce = parseInt(data.result, 16);
    return { nonce: nonce, network: network };
  } catch (e) {
    return { nonce: -1, network: network };
  }
}

async function checkSolana(address) {
  try {
    var resp = await fetch(NETWORKS.solana.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1 }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    var data = await resp.json();
    var sigs = data.result || [];
    if (sigs.length > 0) return { signature: sigs[0].signature, network: 'solana' };
    return null;
  } catch (e) {
    return null;
  }
}

async function checkTron(address) {
  try {
    var url = NETWORKS.tron.api.replace('{ADDRESS}', address);
    var resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    var data = await resp.json();
    var txs = data.data || [];
    if (txs.length > 0) return { txid: txs[0].txID, network: 'tron' };
    return null;
  } catch (e) {
    return null;
  }
}

async function pollWallets() {
  var config = store.load();
  var wallets = config.wallets || [];
  if (wallets.length === 0) return;

  var seenTxs = loadSeenTxs();
  var alerts = [];

  for (var i = 0; i < wallets.length; i++) {
    var w = wallets[i];
    if (w.active === false) continue;
    var key = w.network + ':' + w.address;

    try {
      if (w.network === 'bitcoin') {
        var btcTxs = await checkBitcoin(w.address);
        for (var t = 0; t < btcTxs.length; t++) {
          var txKey = 'btc:' + btcTxs[t].txid;
          if (!seenTxs[txKey]) {
            seenTxs[txKey] = { time: new Date().toISOString(), address: w.address };
            alerts.push({ wallet: w, txid: btcTxs[t].txid, network: 'bitcoin' });
          }
        }
      } else if (w.network === 'tron') {
        var tronResult = await checkTron(w.address);
        if (tronResult) {
          var tronKey = 'tron:' + tronResult.txid;
          if (!seenTxs[tronKey]) {
            seenTxs[tronKey] = { time: new Date().toISOString(), address: w.address };
            alerts.push({ wallet: w, txid: tronResult.txid, network: 'tron' });
          }
        }
      } else if (w.network === 'solana') {
        var solResult = await checkSolana(w.address);
        if (solResult) {
          var solKey = 'sol:' + solResult.signature;
          if (!seenTxs[solKey]) {
            seenTxs[solKey] = { time: new Date().toISOString(), address: w.address };
            alerts.push({ wallet: w, txid: solResult.signature, network: 'solana' });
          }
        }
      } else if (NETWORKS[w.network] && NETWORKS[w.network].type === 'evm') {
        var evmResult = await checkEVM(w.address, w.network);
        var nonceKey = key + ':nonce';
        if (evmResult.nonce >= 0) {
          var prevNonce = seenTxs[nonceKey];
          if (typeof prevNonce === 'number' && evmResult.nonce > prevNonce) {
            alerts.push({ wallet: w, nonce: evmResult.nonce, prevNonce: prevNonce, network: w.network });
          }
          seenTxs[nonceKey] = evmResult.nonce;
        }
      }
    } catch (e) {
      // Silent per-wallet failure — we don't want a single broken RPC to block the whole poll
    }
  }

  saveSeenTxs(seenTxs);

  for (var a = 0; a < alerts.length; a++) {
    try {
      await fireAlert(alerts[a], config);
    } catch (e) {
      console.error('[WALLET-MONITOR] Alert dispatch failed:', e.message);
    }
  }
}

async function fireAlert(alertData, config) {
  var networkName = NETWORKS[alertData.network] ? NETWORKS[alertData.network].name : alertData.network;
  var defaultMessage = 'ALERT: Transaction detected on wallet ' +
    (alertData.wallet.label || alertData.wallet.address.substring(0, 10) + '...') +
    ' on network ' + networkName + '.' +
    (alertData.txid ? ' TX: ' + alertData.txid.substring(0, 16) + '...' : '') +
    ' If you did not authorize this, your funds may be at risk.';

  await alertService.dispatch({
    telegramContacts: config.contacts.telegram,
    smsContacts: config.contacts.sms,
    voiceContacts: config.contacts.voice,
    customMessages: config.customMessages,
    defaultMessage: defaultMessage,
    source: 'wallet_monitor',
    timestamp: new Date().toISOString()
  });

  // Record alert history on the wallet entry
  var fresh = store.load();
  if (fresh.wallets) {
    for (var wi = 0; wi < fresh.wallets.length; wi++) {
      var wc = fresh.wallets[wi];
      if (wc.address === alertData.wallet.address && wc.network === alertData.network) {
        wc.lastAlertAt = new Date().toISOString();
        wc.lastAlertTxid = alertData.txid || ('nonce:' + alertData.nonce);
        wc.alertCount = (wc.alertCount || 0) + 1;
      }
    }
    store.save(fresh);
  }

  console.log('[WALLET-MONITOR] Alert dispatched for ' + alertData.wallet.address.substring(0, 10) + ' on ' + networkName);
}

function start() {
  if (pollTimer) return;
  console.log('[WALLET-MONITOR] Started — polling every ' + (POLL_INTERVAL / 1000) + 's');
  pollWallets();
  pollTimer = setInterval(pollWallets, POLL_INTERVAL);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  start: start,
  stop: stop,
  NETWORKS: NETWORKS
};
