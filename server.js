const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Webshare Static Proxy Config
const PROXY_URL = "http://bcepepze:oo1pdvtip38f@31.59.20.176:6754";
const httpsAgent = new HttpsProxyAgent(PROXY_URL);

// NEKpay Credentials & Endpoints
const CONFIG = {
  mch_id: "808258213", 
  secret_key: "TEATKHM0RPB9ZAVAUHDZPLYHYWLVGI9D", 
  transfer_url: "https://api.watchglb.com/pay/transfer",
  balance_url: "https://api.watchglb.com/query/balance"
};

// সময় ফরম্যাট: yyyy-MM-dd HH:mm:ss
function getCurrentDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// MD5 Signature তৈরির ফাংশন
function generateSign(params, secretKey) {
  const filtered = {};
  for (const key of Object.keys(params)) {
    const val = params[key];
    const lower = key.toLowerCase();
    if (val !== '' && val !== null && val !== undefined && lower !== 'sign' && lower !== 'sign_type') {
      filtered[key] = val;
    }
  }

  const sortedKeys = Object.keys(filtered).sort();
  const sortedString = sortedKeys.map(k => `${k}=${filtered[k]}`).join('&');
  const stringToSign = `${sortedString}&key=${secretKey}`;
  return crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex').toLowerCase();
}

// ড্যাশবোর্ড UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NEKpay Payout Panel</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1329; color: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .card { background: #1a233a; width: 100%; max-width: 420px; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        h2 { margin: 0 0 16px 0; color: #38bdf8; text-align: center; }
        .proxy-badge { background: #0b1329; border: 1px solid #334155; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 18px; font-size: 13px; color: #94a3b8; }
        .proxy-badge b { color: #38bdf8; }
        .bal-box { font-size: 15px; font-weight: bold; color: #4ade80; margin-top: 6px; }
        .refresh-btn { background: #334155; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; margin-top: 6px; }
        label { display: block; margin: 14px 0 6px; font-size: 13px; color: #94a3b8; }
        input, select { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0b1329; color: #fff; box-sizing: border-box; font-size: 15px; }
        button.submit-btn { width: 100%; padding: 14px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin-top: 20px; cursor: pointer; }
        button.submit-btn:hover { background: #0369a1; }
        .res-box { margin-top: 20px; padding: 12px; border-radius: 8px; font-size: 12px; word-break: break-all; background: #0b1329; border: 1px solid #334155; display: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>NEKpay ম্যানুয়াল পেআউট</h2>
        
        <div class="proxy-badge">
          Proxy IP: <b>31.59.20.176</b> | Merchant: <b>808258213</b>
          <div id="balVal" class="bal-box">ব্যালেন্স: লোড হচ্ছে...</div>
          <button type="button" class="refresh-btn" onclick="checkBalance()">Refresh Balance</button>
        </div>

        <form id="payoutForm" onsubmit="handlePayout(event)">
          <label>পেমেন্ট মেথড:</label>
          <select id="bank_code" required>
            <option value="2222">bKash (2222)</option>
            <option value="2221">Nagad (2221)</option>
          </select>

          <label>মোবাইল নাম্বার (১১ ডিজিট):</label>
          <input type="text" id="receive_account" placeholder="017xxxxxxxx" maxlength="11" required />

          <label>গ্রাহকের নাম:</label>
          <input type="text" id="receive_name" value="Customer" required />

          <label>টাকার পরিমাণ (BDT):</label>
          <input type="number" id="transfer_amount" placeholder="100" min="100" step="1" required />

          <button type="submit" id="btnSubmit" class="submit-btn">Send Payout</button>
        </form>

        <pre id="resultBox" class="res-box"></pre>
      </div>

      <script>
        async function checkBalance() {
          const bal = document.getElementById('balVal');
          bal.innerText = "ব্যালেন্স: চেক করা হচ্ছে...";
          try {
            const res = await fetch('/api/balance');
            const data = await res.json();
            if (data.respCode === "SUCCESS") {
              bal.innerText = "Available Balance: " + data.availableAmount + " BDT";
            } else {
              bal.innerText = "Error: " + (data.errorMsg || data.respCode || "Failed");
            }
          } catch (e) {
            bal.innerText = "ব্যালেন্স লোড ব্যর্থ হয়েছে";
          }
        }

        async function handlePayout(e) {
          e.preventDefault();
          const btn = document.getElementById('btnSubmit');
          const resBox = document.getElementById('resultBox');
          btn.disabled = true;
          btn.innerText = "প্রসেসিং হচ্ছে...";
          resBox.style.display = "none";

          const payload = {
            bank_code: document.getElementById('bank_code').value,
            receive_account: document.getElementById('receive_account').value,
            receive_name: document.getElementById('receive_name').value,
            transfer_amount: document.getElementById('transfer_amount').value
          };

          try {
            const res = await fetch('/submit-payout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            resBox.style.display = "block";
            resBox.innerText = JSON.stringify(data, null, 2);
            checkBalance();
          } catch (err) {
            resBox.style.display = "block";
            resBox.innerText = "Request Failed: " + err.message;
          } finally {
            btn.disabled = false;
            btn.innerText = "Send Payout";
          }
        }

        checkBalance();
      </script>
    </body>
    </html>
  `);
});

// ব্যালেন্স চেক API
app.get('/api/balance', async (req, res) => {
  const payload = {
    mch_id: CONFIG.mch_id,
    sign_type: "MD5"
  };
  payload.sign = generateSign(payload, CONFIG.secret_key);

  const formBody = new URLSearchParams(payload).toString();

  try {
    const response = await axios.post(CONFIG.balance_url, formBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: httpsAgent,
      timeout: 30000
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.response ? error.response.data : null });
  }
});

// পেআউট প্রসেস হ্যান্ডলার
app.post('/submit-payout', async (req, res) => {
  const { bank_code, receive_account, receive_name, transfer_amount } = req.body;

  const mch_transferId = 'TRX' + Date.now() + Math.floor(Math.random() * 1000);
  const apply_date = getCurrentDate();

  const payload = {
    mch_id: CONFIG.mch_id,
    mch_transferId: mch_transferId,
    transfer_amount: String(parseInt(transfer_amount)),
    apply_date: apply_date,
    bank_code: bank_code,
    receive_name: receive_name,
    receive_account: receive_account,
    sign_type: "MD5"
  };

  payload.sign = generateSign(payload, CONFIG.secret_key);
  const formBody = new URLSearchParams(payload).toString();

  try {
    const response = await axios.post(CONFIG.transfer_url, formBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: httpsAgent,
      timeout: 30000
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.response ? error.response.data : null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
