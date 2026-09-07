const root = document.documentElement;
const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const themeButton = document.querySelector('[data-theme-button]');
const copyButton = document.querySelector('[data-copy-email]');
const toast = document.querySelector('[data-toast]');

const savedTheme = localStorage.getItem('profile-theme');
const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'dark' || (!savedTheme && preferredDark)) root.dataset.theme = 'dark';

function updateThemeLabel() {
  const isDark = root.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', isDark ? '라이트 테마로 전환' : '다크 테마로 전환');
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#191b18' : '#f4f1ea';
}
updateThemeLabel();

themeButton.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('profile-theme', next);
  updateThemeLabel();
});

function closeMenu() {
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
}

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menu.classList.toggle('open', !open);
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.setAttribute('aria-label', open ? '메뉴 열기' : '메뉴 닫기');
});

document.querySelectorAll('.menu a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 12), { passive: true });
document.querySelector('[data-year]').textContent = new Date().getFullYear();

const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.menu a[href^="#"]');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${entry.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-35% 0px -55%', threshold: 0 });
sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

copyButton?.addEventListener('click', async () => {
  const email = copyButton.dataset.copyEmail;
  try {
    await navigator.clipboard.writeText(email);
  } catch {
    const input = document.createElement('textarea');
    input.value = email;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  copyButton.querySelector('[data-copy-label]').textContent = '복사 완료';
  toast.classList.add('show');
  window.setTimeout(() => {
    copyButton.querySelector('[data-copy-label]').textContent = '이메일 복사';
    toast.classList.remove('show');
  }, 2200);
});
