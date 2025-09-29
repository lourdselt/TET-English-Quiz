const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());
// set this to your deployed Apps Script Web App URL
const TARGET = 'https://script.google.com/macros/s/AKfycbzVi6HwMm_6SHFZSHyNKfkN88aKp-I9IC4OgbKdCyZXYfQ1K16FVgtl8CnGThJIe4iM_g/exe';
app.post('/sheet-proxy', async (req, res) => {
  try{
    const r = await fetch(TARGET, { method: 'POST', body: JSON.stringify(req.body) });
    const text = await r.text();
    res.set('Access-Control-Allow-Origin','*');
    res.type('application/json').send(text);
  }catch(err){
    res.set('Access-Control-Allow-Origin','*');
    res.status(500).json({error: err.toString()});
  }
});
app.options('/sheet-proxy', (req,res)=> res.set('Access-Control-Allow-Origin','*').set('Access-Control-Allow-Methods','POST,OPTIONS').set('Access-Control-Allow-Headers','Content-Type').send('ok'));
app.listen(3000);
