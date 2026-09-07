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

// NEKpay Credentials
const CONFIG = {
  mch_id: "808258213", 
  secret_key: "TEATKHM0RPB9ZAVAUHDZPLYHYWLVGI9D", 
  api_url: "https://api.nekpayment.com/pay/transfer"
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
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined && key !== 'sign' && key !== 'sign_type') {
      filtered[key] = params[key];
    }
  }

  const sortedKeys = Object.keys(filtered).sort();
  const sortedString = sortedKeys.map(k => `${k}=${filtered[k]}`).join('&');
  const stringToSign = `${sortedString}&key=${secretKey}`;
  return crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex');
}

// ম্যানুয়াল পেআউট ড্যাশবোর্ড UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NEKpay Payout Panel</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 20px; }
        .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 420px; }
        h2 { margin-top: 0; color: #1a1a1a; text-align: center; }
        label { display: block; margin: 14px 0 6px; font-weight: 600; font-size: 14px; color: #333; }
        input, select { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
        button { width: 100%; padding: 12px; background: #008060; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin-top: 22px; cursor: pointer; }
        button:hover { background: #006e52; }
        .proxy-info { background: #e8f5e9; padding: 10px; border-radius: 6px; font-size: 12px; color: #2e7d32; text-align: center; margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>NEKpay ম্যানুয়াল পেআউট</h2>
        <div class="proxy-info">আউটগোয়িং আইপি: <b>31.59.20.176</b> (Marchant: 808258213)</div>
        <form method="POST" action="/submit-payout">
          <label>পেমেন্ট চ্যানেল:</label>
          <select name="bank_code">
            <option value="baksha">বিকাশ (bKash)</option>
            <option value="and">নগদ (Nagad)</option>
          </select>

          <label>মোবাইল নাম্বার (১১ সংখ্যা):</label>
          <input type="text" name="receive_account" placeholder="017xxxxxxxx" maxlength="11" required />

          <label>গ্রাহকের নাম (কমপক্ষে ৫ ইংরেজি অক্ষর):</label>
          <input type="text" name="receive_name" value="CustomerName" required />

          <label>টাকার পরিমাণ (মিনিমাম ১০০):</label>
          <input type="number" name="transfer_amount" placeholder="100" min="100" step="1" required />

          <button type="submit">উইথড্র কনফার্ম করুন</button>
        </form>
      </div>
    </body>
    </html>
  `);
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

  const sign = generateSign(payload, CONFIG.secret_key);
  payload.sign = sign;

  const formBody = new URLSearchParams(payload).toString();

  try {
    const response = await axios.post(CONFIG.api_url, formBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      httpsAgent: httpsAgent,
      timeout: 30000
    });

    res.send(`
      <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto;">
        <h2>পেআউট রেসপন্স</h2>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
          <pre>${JSON.stringify(response.data, null, 2)}</pre>
        </div>
        <br/>
        <a href="/" style="display: inline-block; padding: 10px 16px; background: #008060; color: white; text-decoration: none; border-radius: 6px;">আরেকটি পেআউট করুন</a>
      </div>
    `);
  } catch (error) {
    res.status(500).send(`
      <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto;">
        <h2 style="color: red;">ব্যর্থ হয়েছে</h2>
        <p><b>Error:</b> ${error.message}</p>
        ${error.response ? `<pre>${JSON.stringify(error.response.data, null, 2)}</pre>` : ''}
        <br/>
        <a href="/">পুনরায় চেষ্টা করুন</a>
      </div>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
