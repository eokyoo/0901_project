const CONFIG = {
  SPREADSHEET_ID: '1hF70y4LmbRMkM3ByFG9E2-10yYCGHi68Lx8_ivIME78',
  USERS_SHEET: 'Users',
  SESSIONS_SHEET: 'Sessions',
  SESSION_DAYS: 7
};

function setup() {
  initialize_();
  return '초기 설정이 완료되었습니다.';
}

function initialize_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    initializeUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function initializeUnlocked_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSheet_(spreadsheet, CONFIG.USERS_SHEET, ['id', 'email', 'name', 'passwordHash', 'salt', 'status', 'createdAt', 'lastLoginAt']);
  const sessions = ensureSheet_(spreadsheet, CONFIG.SESSIONS_SHEET, ['tokenHash', 'userId', 'expiresAt', 'createdAt']);
  if (!sessions.isSheetHidden()) sessions.hideSheet();
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty('PASSWORD_PEPPER', Utilities.getUuid() + Utilities.getUuid());
  }
}

function doGet() {
  return json_({ ok: true, message: 'Minjun Blog Auth API' });
}

function doPost(e) {
  try {
    initialize_();
    const body = parseBody_(e);
    switch (body.action) {
      case 'signup': return json_(signup_(body));
      case 'login': return json_(login_(body));
      case 'logout': return json_(logout_(body));
      case 'me': return json_(me_(body));
      default: return json_({ ok: false, message: '지원하지 않는 요청입니다.' });
    }
  } catch (error) {
    console.error(error);
    return json_({ ok: false, message: error.message || '서버 오류가 발생했습니다.' });
  }
}

function signup_(body) {
  const email = normalizeEmail_(body.email);
  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일을 입력해 주세요.');
  if (name.length < 2 || name.length > 30) throw new Error('이름은 2자 이상 30자 이하로 입력해 주세요.');
  if (password.length < 8 || password.length > 100) throw new Error('비밀번호는 8자 이상 100자 이하로 입력해 주세요.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // initialize_와 같은 잠금을 중첩하지 않도록 초기화 후 가입 처리만 잠급니다.
    const sheet = getSheet_(CONFIG.USERS_SHEET);
    if (findUserByEmail_(sheet, email)) throw new Error('이미 가입된 이메일입니다.');
    const id = Utilities.getUuid();
    const salt = Utilities.getUuid();
    const now = new Date();
    sheet.appendRow([id, email, name, hashPassword_(password, salt), salt, 'active', now, '']);
    return createSession_(id, { id, email, name });
  } finally {
    lock.releaseLock();
  }
}

function login_(body) {
  const email = normalizeEmail_(body.email);
  const password = String(body.password || '');
  const sheet = getSheet_(CONFIG.USERS_SHEET);
  const record = findUserByEmail_(sheet, email);
  if (!record || record.status !== 'active' || !safeEqual_(record.passwordHash, hashPassword_(password, record.salt))) {
    throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
  }
  sheet.getRange(record.row, 8).setValue(new Date());
  return createSession_(record.id, { id: record.id, email: record.email, name: record.name });
}

function logout_(body) {
  const tokenHash = hashToken_(String(body.token || ''));
  const sheet = getSheet_(CONFIG.SESSIONS_SHEET);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (safeEqual_(String(values[i][0]), tokenHash)) sheet.deleteRow(i + 1);
  }
  return { ok: true };
}

function me_(body) {
  const session = findSession_(String(body.token || ''));
  if (!session) throw new Error('로그인이 만료되었습니다.');
  const users = getSheet_(CONFIG.USERS_SHEET).getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (String(users[i][0]) === session.userId) {
      return { ok: true, user: { id: users[i][0], email: users[i][1], name: users[i][2] } };
    }
  }
  throw new Error('사용자를 찾을 수 없습니다.');
}

function createSession_(userId, user) {
  const token = Utilities.base64EncodeWebSafe(Utilities.getUuid() + ':' + Utilities.getUuid()).replace(/=+$/, '');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIG.SESSION_DAYS * 86400000);
  getSheet_(CONFIG.SESSIONS_SHEET).appendRow([hashToken_(token), userId, expiresAt, now]);
  return { ok: true, token, expiresAt: expiresAt.toISOString(), user };
}

function findSession_(token) {
  if (!token) return null;
  const hash = hashToken_(token);
  const sheet = getSheet_(CONFIG.SESSIONS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const now = Date.now();
  for (let i = rows.length - 1; i >= 1; i--) {
    const expires = new Date(rows[i][2]).getTime();
    if (expires <= now) { sheet.deleteRow(i + 1); continue; }
    if (safeEqual_(String(rows[i][0]), hash)) return { userId: String(rows[i][1]), expiresAt: expires };
  }
  return null;
}

function findUserByEmail_(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][1]) === email) {
      return { row: i + 1, id: String(rows[i][0]), email: String(rows[i][1]), name: String(rows[i][2]), passwordHash: String(rows[i][3]), salt: String(rows[i][4]), status: String(rows[i][5]) };
    }
  }
  return null;
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  if (!pepper) throw new Error('인증 서버 비밀값을 초기화하지 못했습니다. Apps Script 실행 권한을 확인해 주세요.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(password + ':' + salt, pepper)).replace(/=+$/, '');
}

function hashToken_(token) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeEmail_(value) { return String(value || '').trim().toLowerCase(); }
function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('인증 데이터 시트를 초기화하지 못했습니다. 스프레드시트 접근 권한을 확인해 주세요.');
  return sheet;
}
function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  return sheet;
}
function parseBody_(e) {
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  return e && e.parameter ? e.parameter : {};
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
