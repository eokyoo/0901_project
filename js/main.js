const root = document.documentElement;
const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const themeButton = document.querySelector('[data-theme-button]');
const toast = document.querySelector('[data-toast]');
const authTokenKey = 'minjun-blog-session';
const authUserKey = 'minjun-blog-user';

try {
  const savedTheme = localStorage.getItem('blog-theme');
  if (savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme:dark)').matches)) root.dataset.theme = 'dark';
} catch (_) {}

function themeLabel() {
  if (!themeButton) return;
  const dark = root.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#151613' : '#f7f7f2';
}
themeLabel();
themeButton?.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('blog-theme', root.dataset.theme); } catch (_) {}
  themeLabel();
});

function closeMenu() { menu?.classList.remove('open'); menuButton?.setAttribute('aria-expanded', 'false'); }
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menu?.classList.toggle('open', !open);
  menuButton.setAttribute('aria-expanded', String(!open));
});
menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
addEventListener('scroll', () => header?.classList.toggle('scrolled', scrollY > 8), { passive: true });
document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, current) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); current.unobserve(entry.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));

window.showBlogToast = function (message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
};

function storedUser() {
  try { return JSON.parse(localStorage.getItem(authUserKey) || 'null'); }
  catch (_) { localStorage.removeItem(authUserKey); return null; }
}
function prepareAuthNavigation() {
  document.querySelectorAll('.menu').forEach((navMenu) => {
    if (navMenu.querySelector('[data-auth-guest]')) return;
    const signup = navMenu.querySelector('a[href="signup.html"]');
    if (!signup) return;
    let login = navMenu.querySelector('a[href="login.html"]');
    if (!login) { login = document.createElement('a'); login.href = 'login.html'; login.textContent = '로그인'; signup.before(login); }
    login.dataset.authGuest = ''; signup.dataset.authGuest = '';
    const profile = document.createElement('a');
    profile.href = 'profile.html'; profile.textContent = '프로필'; profile.dataset.authUser = ''; profile.hidden = true;
    const logout = document.createElement('a');
    logout.href = '#logout'; logout.textContent = '로그아웃'; logout.className = 'join-link'; logout.dataset.authUser = ''; logout.dataset.logout = ''; logout.hidden = true;
    signup.after(profile, logout);
  });
}
function renderAuthNavigation(user) {
  document.querySelectorAll('[data-auth-guest]').forEach((element) => { element.hidden = Boolean(user); });
  document.querySelectorAll('[data-auth-user]').forEach((element) => { element.hidden = !user; });
}
function handleLogout(event) {
  event.preventDefault();
  const token = localStorage.getItem(authTokenKey);
  const apiUrl = window.APP_CONFIG?.appsScriptUrl;
  if (token && apiUrl && navigator.sendBeacon) navigator.sendBeacon(apiUrl, new Blob([JSON.stringify({ action: 'logout', token })], { type: 'text/plain;charset=utf-8' }));
  localStorage.removeItem(authTokenKey); localStorage.removeItem(authUserKey); location.href = 'index.html';
}
prepareAuthNavigation();
renderAuthNavigation(storedUser());
document.querySelectorAll('[data-logout]').forEach((element) => element.addEventListener('click', handleLogout));
const postsScript = document.createElement('script'); postsScript.src = 'js/posts.js'; document.head.append(postsScript);
