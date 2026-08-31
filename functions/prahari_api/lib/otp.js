'use strict'

const axios = require('axios')
const crypto = require('crypto')
const catalyst = require('zcatalyst-sdk-node')
const { env } = require('./util')

/* Email, not SMS. India's TRAI DLT regime requires entity registration plus
   sender-ID and template approval before a transactional SMS will deliver, which
   is not something a team clears in a week. `contact_type` on the reporters table
   keeps the channel swappable, so moving to phone later is a provider change
   rather than a migration.

   Delivery goes through Catalyst's own email service first. An earlier pass
   concluded Catalyst had no email and reached for Brevo; that was wrong — the SDK
   exposes email().sendMail(), which keeps this on-stack, needs no third-party API
   key, and does not consume a separate free-tier quota. Brevo stays as an
   override for anyone who wants it. There is no floor: with no channel
   configured and demo mode off, sending fails and the caller must say so. */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const DEMO_CODE = '000000'

/* Opt-in, not opt-out. DEMO_CODE is published in this repository, so a
   deployment that inherits demo mode by omission accepts one known code for
   every address. Defaulting off means forgetting to configure mail breaks the
   OTP flow loudly rather than leaving it open. */
function isDemo() {
  return env('OTP_DEMO_MODE', 'false') === 'true'
}

function generateCode() {
  if (isDemo()) return DEMO_CODE
  // randomInt avoids the modulo bias a randomBytes-and-mod would carry.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

function subjectFor(lang) {
  return lang === 'kn' ? 'PRAHARI ಪರಿಶೀಲನಾ ಸಂಕೇತ' : 'PRAHARI verification code'
}

function textFor(code, lang) {
  if (lang === 'kn') {
    return 'ನಿಮ್ಮ PRAHARI ಪರಿಶೀಲನಾ ಸಂಕೇತ: ' + code + '\n\n' +
      'ಇದು 10 ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ. ನೀವು ಇದನ್ನು ಕೇಳದಿದ್ದರೆ ಈ ಸಂದೇಶವನ್ನು ನಿರ್ಲಕ್ಷಿಸಿ.\n\n' +
      'ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ 112 ಕರೆ ಮಾಡಿ. ಈ ಇಮೇಲ್‌ಗೆ ಉತ್ತರಿಸಬೇಡಿ.'
  }
  return 'Your PRAHARI verification code is ' + code + '\n\n' +
    'It expires in 10 minutes. If you did not request it, ignore this message.\n\n' +
    'In an emergency call 112. This mailbox is not monitored.'
}

async function viaCatalyst(req, toEmail, code, lang) {
  const from = env('MAIL_SENDER_EMAIL')
  if (!from || !req) return false
  try {
    await catalyst.initialize(req).email().sendMail({
      from_email: from,
      to_email: [toEmail],
      subject: subjectFor(lang),
      content: textFor(code, lang),
    })
    return true
  } catch (e) {
    console.error('[otp] catalyst sendMail failed:', e.message)
    return false
  }
}

async function viaBrevo(toEmail, code, lang) {
  const key = env('BREVO_API_KEY')
  const sender = env('BREVO_SENDER_EMAIL')
  if (!key || !sender) return false
  try {
    await axios.post(
      BREVO_URL,
      {
        sender: { email: sender, name: env('BREVO_SENDER_NAME', 'PRAHARI') },
        to: [{ email: toEmail }],
        subject: subjectFor(lang),
        textContent: textFor(code, lang),
      },
      {
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        timeout: 8000,
      },
    )
    return true
  } catch (e) {
    console.error('[otp] brevo send failed:', e && e.response ? e.response.status : e.message)
    return false
  }
}

/**
 * Returns { sent, demo }. Never throws on a delivery failure: the challenge is
 * already stored, and a failed send must not tell an enumerating caller whether
 * the address exists.
 */
async function sendCode(req, toEmail, code, lang) {
  if (isDemo()) return { sent: false, demo: true }
  if (await viaCatalyst(req, toEmail, code, lang)) return { sent: true, demo: false }
  if (await viaBrevo(toEmail, code, lang)) return { sent: true, demo: false }
  /* Nothing delivered and we are not in demo mode: the caller still gets a
     challenge id, so the flow does not leak which addresses exist, but the
     operator needs to see this. */
  console.error('[otp] no delivery channel configured; code was not sent')
  return { sent: false, demo: false }
}

module.exports = { generateCode, sendCode, isDemo, DEMO_CODE }
