'use strict'

const axios = require('axios')
const crypto = require('crypto')
const { env } = require('./util')

/* Email, not SMS. India's TRAI DLT regime requires entity registration plus
   sender-ID and template approval before a transactional SMS will deliver, which
   is not a thing a team clears in a week — and Catalyst has no SMS service of its
   own regardless. Email has none of that, costs nothing at this volume, and the
   `contact_type` column means switching later is a provider swap, not a
   migration. */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

function isDemo() {
  // Demo unless a key is actually configured — a missing key must degrade to a
  // visible fixed code, never to a silent send-nothing that looks like success.
  return env('OTP_DEMO_MODE', 'true') === 'true' || !env('BREVO_API_KEY')
}

const DEMO_CODE = '000000'

function generateCode() {
  if (isDemo()) return DEMO_CODE
  // crypto.randomInt avoids the modulo bias a randomBytes-and-mod would carry.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

function subjectFor(lang) {
  return lang === 'kn' ? 'PRAHARI ಪರಿಶೀಲನಾ ಸಂಕೇತ' : 'PRAHARI verification code'
}

function bodyFor(code, lang) {
  if (lang === 'kn') {
    return {
      text:
        'ನಿಮ್ಮ PRAHARI ಪರಿಶೀಲನಾ ಸಂಕೇತ: ' + code + '\n\n' +
        'ಇದು 10 ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ. ನೀವು ಇದನ್ನು ಕೇಳದಿದ್ದರೆ ಈ ಸಂದೇಶವನ್ನು ನಿರ್ಲಕ್ಷಿಸಿ.\n\n' +
        'ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ 112 ಕರೆ ಮಾಡಿ. ಈ ಇಮೇಲ್‌ಗೆ ಉತ್ತರಿಸಬೇಡಿ.',
    }
  }
  return {
    text:
      'Your PRAHARI verification code is ' + code + '\n\n' +
      'It expires in 10 minutes. If you did not request it, ignore this message.\n\n' +
      'In an emergency call 112. This mailbox is not monitored.',
  }
}

/**
 * Returns { sent: boolean, demo: boolean }. Never throws on a delivery failure —
 * the challenge is already stored, and a failed send must not tell an enumerating
 * caller whether the address exists.
 */
async function sendCode(toEmail, code, lang) {
  if (isDemo()) return { sent: false, demo: true }

  const sender = {
    email: env('BREVO_SENDER_EMAIL'),
    name: env('BREVO_SENDER_NAME', 'PRAHARI'),
  }
  if (!sender.email) return { sent: false, demo: false }

  try {
    await axios.post(
      BREVO_URL,
      {
        sender,
        to: [{ email: toEmail }],
        subject: subjectFor(lang),
        textContent: bodyFor(code, lang).text,
      },
      {
        headers: {
          'api-key': env('BREVO_API_KEY'),
          'content-type': 'application/json',
          accept: 'application/json',
        },
        timeout: 8000,
      },
    )
    return { sent: true, demo: false }
  } catch (e) {
    // Log for the operator, stay silent to the caller.
    console.error('[otp] brevo send failed:', e && e.response ? e.response.status : e.message)
    return { sent: false, demo: false }
  }
}

module.exports = { generateCode, sendCode, isDemo, DEMO_CODE }
