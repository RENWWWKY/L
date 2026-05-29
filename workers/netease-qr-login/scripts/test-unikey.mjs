import CryptoJS from 'crypto-js'

const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const IV = CryptoJS.enc.Utf8.parse('0102030405060708')
const PUBLIC_KEY = '010001'
const MODULUS =
  '00e0b90f8ece75da7eac459fb7400b1ad15176ec011ba428da0ed6f4f64fc90dc27f274e45de5dadc0141e0fa561eb860a5a9f875a4ce80142d5228eaeb9220e2fe580e90d85675eabc546a2ab9fdeee1fba95f9df78ce5c9e93b977454fdc48691977fa469c310ca7d'

function aesEncrypt(text, secKey) {
  const key = CryptoJS.enc.Utf8.parse(secKey)
  const src = CryptoJS.enc.Utf8.parse(text)
  return CryptoJS.AES.encrypt(src, key, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString()
}

function rsaEncrypt(text) {
  const reversed = text.split('').reverse().join('')
  const biText = BigInt(
    `0x${CryptoJS.enc.Utf8.parse(reversed).toString(CryptoJS.enc.Hex)}`,
  )
  const biEx = BigInt(`0x${PUBLIC_KEY}`)
  const biMod = BigInt(`0x${MODULUS}`)
  let biRet = 1n
  let base = biText % biMod
  let exp = biEx
  while (exp > 0n) {
    if (exp % 2n === 1n) biRet = (biRet * base) % biMod
    exp /= 2n
    base = (base * base) % biMod
  }
  return biRet.toString(16).padStart(256, '0')
}

function encryptWeapi(data) {
  const text = JSON.stringify(data)
  const pool =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let secretKey = ''
  for (let i = 0; i < 16; i++) secretKey += pool.charAt(Math.floor(Math.random() * pool.length))
  const params = aesEncrypt(aesEncrypt(text, PRESET_KEY), secretKey)
  const encSecKey = rsaEncrypt(secretKey)
  return { params, encSecKey }
}

const { params, encSecKey } = encryptWeapi({ csrf_token: '' })
const body = new URLSearchParams({ params, encSecKey })
const res = await fetch('https://music.163.com/weapi/login/qrcode/unikey?csrf_token=', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
  },
  body: body.toString(),
})
const t = await res.text()
console.log('crypto-js status', res.status, 'len', t.length)
console.log(t.slice(0, 500))
