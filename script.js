'use strict';

/*
========================================================
 افـنـدツينا🥀🖤
 script.js — الجزء الأول
========================================================

 - تسجيل الدخول
 - إنشاء حساب
 - التحقق من الجلسة
 - تسجيل الخروج
 - حماية الصفحة
 - الملف الشخصي
 - Level / XP / Coins
 - البحث
 - التنقل
 - القائمة الجانبية
 - الوضع الليلي
 - الإشعارات بدون بيانات وهمية
========================================================
*/

const Afendina = (() => {

  const API = '/api';

  const state = {
    user: null,
    notifications: [],
    messages: [],
    gifts: [],
    friends: [],
    achievements: [],
    tasks: [],
    leaderboard: [],
    loading: false
  };

  /* =========================
     أدوات عامة
  ========================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function notify(message, type = 'info') {
    let box = $('#afendina-toast-container');

    if (!box) {
      box = document.createElement('div');
      box.id = 'afendina-toast-container';

      Object.assign(box.style, {
        position: 'fixed',
        zIndex: '99999',
        left: '18px',
        bottom: '18px',
        display: 'grid',
        gap: '8px',
        maxWidth: 'calc(100vw - 36px)'
      });

      document.body.appendChild(box);
    }

    const toast = document.createElement('div');

    toast.textContent = message;

    Object.assign(toast.style, {
      padding: '12px 16px',
      borderRadius: '12px',
      background:
        type === 'error'
          ? '#5b1728'
          : type === 'success'
            ? '#124c32'
            : '#211735',
      color: '#fff',
      border: '1px solid rgba(255,255,255,.12)',
      boxShadow: '0 15px 40px rgba(0,0,0,.3)',
      fontSize: '13px'
    });

    box.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  async function request(url, options = {}) {

    const response = await fetch(
      API + url,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {

      const error = new Error(
        data.message ||
        'حدث خطأ في الاتصال بالسيرفر.'
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  /* =========================
     المستخدم
  ========================= */

  function setUser(user) {

    state.user = user || null;

    if (!user) return;

    const name =
      user.username ||
      user.name ||
      'مستخدم';

    const level =
      Number(user.level || 1);

    const xp =
      Number(user.xp || 0);

    const coins =
      Number(user.coins || 0);

    $$('[data-user-name]')
      .forEach(el => {
        el.textContent = name;
      });

    $$('[data-username]')
      .forEach(el => {
        el.textContent = name;
      });

    $$('[data-user-email]')
      .forEach(el => {
        el.textContent =
          user.email || '';
      });

    $$('[data-user-level]')
      .forEach(el => {
        el.textContent = level;
      });

    $$('[data-user-xp]')
      .forEach(el => {
        el.textContent = xp;
      });

    $$('[data-user-coins]')
      .forEach(el => {
        el.textContent = coins;
      });

    updateLevelUI(user);
  }

  function updateLevelUI(user) {

    const level =
      Math.max(
        1,
        Number(user.level || 1)
      );

    const xp =
      Math.max(
        0,
        Number(user.xp || 0)
      );

    /*
      لا نخترع قيمة XP من السيرفر.
      نستخدم فقط القيمة القادمة من الحساب.
    */

    const current =
      xp % 100;

    const progress =
      Math.min(
        100,
        Math.max(
          0,
          current
        )
      );

    $$('[data-level-progress]')
      .forEach(el => {
        el.style.width =
          `${progress}%`;
      });

    $$('[data-level]')
      .forEach(el => {
        el.textContent = level;
      });

    $$('[data-xp]')
      .forEach(el => {
        el.textContent = xp;
      });
  }

  /* =========================
     تسجيل الدخول
  ========================= */

  async function login(email, password) {

    if (!email || !password) {
      throw new Error(
        'اكتب البريد الإلكتروني وكلمة المرور.'
      );
    }

    const data =
      await request(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password
          })
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        'فشل تسجيل الدخول.'
      );
    }

    setUser(data.user);

    notify(
      'تم تسجيل الدخول بنجاح.',
      'success'
    );

    return data;
  }

  /* =========================
     إنشاء حساب
  ========================= */

  async function register(
    username,
    email,
    password
  ) {

    if (!username || !email || !password) {
      throw new Error(
        'أكمل جميع بيانات التسجيل.'
      );
    }

    const data =
      await request(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            username,
            email,
            password
          })
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        'فشل إنشاء الحساب.'
      );
    }

    setUser(data.user);

    notify(
      'تم إنشاء الحساب بنجاح.',
      'success'
    );

    return data;
  }

  /* =========================
     الجلسة الحالية
  ========================= */

  async function loadCurrentUser() {

    try {

      const data =
        await request(
          '/auth/me'
        );

      if (
        data.success &&
        data.authenticated &&
        data.user
      ) {

        setUser(data.user);

        return data.user;
      }

      state.user = null;

      return null;

    } catch (error) {

      if (error.status === 401) {
        state.user = null;
        return null;
      }

      throw error;
    }
  }

  /* =========================
     تسجيل الخروج
  ========================= */

  async function logout() {

    try {

      await request(
        '/auth/logout',
        {
          method: 'POST'
        }
      );

    } catch {
      /*
        حتى لو انتهت الجلسة على السيرفر،
        ننظف الواجهة.
      */
    }

    state.user = null;

    notify(
      'تم تسجيل الخروج.',
      'success'
    );

    /*
      لو auth.html موجود نرجع له.
    */

    if (
      location.pathname !== '/auth.html' &&
      document.querySelector(
        '[data-auth-page]'
      )
    ) {
      location.href = 'auth.html';
      return;
    }

    renderAuthState();
  }

  /* =========================
     حماية الصفحة
  ========================= */

  function requireAuth() {

    if (!state.user) {

      const authPage =
        document.querySelector(
          '[data-auth-page]'
        );

      if (!authPage) {
        location.href = 'auth.html';
      }

      return false;
    }

    return true;
  }

  function renderAuthState() {

    const loggedIn =
      Boolean(state.user);

    $$('[data-auth-only]')
      .forEach(el => {
        el.classList.toggle(
          'hidden',
          !loggedIn
        );
      });

    $$('[data-guest-only]')
      .forEach(el => {
        el.classList.toggle(
          'hidden',
          loggedIn
        );
      });
  }

  /* =========================
     التنقل
  ========================= */

  function showView(id) {

    const views =
      $$('.view');

    if (!views.length) return;

    views.forEach(view => {
      view.classList.toggle(
        'active',
        view.id === id
      );
    });

    $$('[data-view]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.view === id
        );
      });

    history.replaceState(
      null,
      '',
      `#${id}`
    );
  }

  function initNavigation() {

    $$('[data-view]')
      .forEach(button => {

        button.addEventListener(
          'click',
          event => {

            event.preventDefault();

            const id =
              button.dataset.view;

            if (id) {
              showView(id);
            }

            closeMobileMenu();
          }
        );
      });

    const hash =
      location.hash.replace(
        '#',
        ''
      );

    if (
      hash &&
      document.getElementById(hash)
    ) {
      showView(hash);
    }
  }

  /* =========================
     الموبايل
  ========================= */

  function openMobileMenu() {

    document.body.classList.add(
      'mobile-nav-open'
    );

    const sidebar =
      $('.sidebar');

    if (sidebar) {
      sidebar.classList.add(
        'open'
      );
    }
  }

  function closeMobileMenu() {

    document.body.classList.remove(
      'mobile-nav-open'
    );

    const sidebar =
      $('.sidebar');

    if (sidebar) {
      sidebar.classList.remove(
        'open'
      );
    }
  }

  function initMobileMenu() {

    const button =
      $('.mobile-menu');

    if (button) {
      button.addEventListener(
        'click',
        () => {

          const sidebar =
            $('.sidebar');

          if (
            sidebar &&
            sidebar.classList.contains(
              'open'
            )
          ) {
            closeMobileMenu();
          } else {
            openMobileMenu();
          }

        }
      );
    }
  }

  /* =========================
     الوضع الليلي
  ========================= */

  function initTheme() {

    const saved =
      localStorage.getItem(
        'afendina_theme'
      );

    if (saved === 'light') {
      document.body.classList.add(
        'light'
      );
    }

    $$('[data-theme-toggle]')
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const light =
              document.body.classList.toggle(
                'light'
              );

            localStorage.setItem(
              'afendina_theme',
              light
                ? 'light'
                : 'dark'
            );
          }
        );

      });
  }

  /* =========================
     البحث
  ========================= */

  function initSearch() {

    const inputs =
      $$('[data-search]');

    inputs.forEach(input => {

      input.addEventListener(
        'input',
        () => {

          const query =
            input.value
              .trim()
              .toLowerCase();

          const target =
            input.dataset.searchTarget;

          if (!target) return;

          const items =
            $$(
              target
            );

          items.forEach(item => {

            const text =
              item.textContent
                .toLowerCase();

            item.classList.toggle(
              'hidden',
              query.length > 0 &&
              !text.includes(query)
            );

          });

        }
      );

    });
  }

  /* =========================
     الإشعارات
  ========================= */

  async function loadNotifications() {

    /*
      مهم:
      لا نضع إشعارات وهمية.

      لو الـAPI غير موجود، نترك
      القائمة فارغة بدل اختراع بيانات.
    */

    try {

      const data =
        await request(
          '/notifications'
        );

      if (
        Array.isArray(
          data.notifications
        )
      ) {

        state.notifications =
          data.notifications;

      } else {

        state.notifications = [];
      }

      renderNotifications();

    } catch (error) {

      if (
        error.status === 404
      ) {

        state.notifications = [];
        renderNotifications();
        return;
      }

      console.error(
        'notifications:',
        error
      );
    }
  }

  function renderNotifications() {

    const list =
      $('#notifications-list');

    if (!list) return;

    list.innerHTML = '';

    if (
      state.notifications.length === 0
    ) {

      list.innerHTML =
        '<div class="empty-state">لا توجد إشعارات.</div>';

    } else {

      state.notifications
        .forEach(notification => {

          const item =
            document.createElement(
              'div'
            );

          item.className =
            'notification-item';

          item.textContent =
            notification.message ||
            notification.text ||
            '';

          list.appendChild(item);
        });
    }

    const unread =
      state.notifications
        .filter(
          item =>
            !item.read &&
            !item.isRead
        ).length;

    $$('[data-notification-count]')
      .forEach(el => {

        if (unread > 0) {
          el.textContent = unread;
          el.classList.remove(
            'hidden'
          );
        } else {
          el.textContent = '';
          el.classList.add(
            'hidden'
          );
        }
      });
  }

  /* =========================
     النوافذ
  ========================= */

  function closeModals() {

    $$('.modal')
      .forEach(modal => {
        modal.classList.remove(
          'open'
        );
        modal.classList.add(
          'hidden'
        );
      });

    document.body.classList.remove(
      'modal-open'
    );
  }

  function openModal(selector) {

    const modal =
      typeof selector === 'string'
        ? $(selector)
        : selector;

    if (!modal) return;

    modal.classList.remove(
      'hidden'
    );

    modal.classList.add(
      'open'
    );

    document.body.classList.add(
      'modal-open'
    );
  }

  /* =========================
     ربط فورم الدخول
  ========================= */

  function initAuthForms() {

    const loginForm =
      $('#login-form') ||
      $('[data-login-form]');

    if (loginForm) {

      loginForm.addEventListener(
        'submit',
        async event => {

          event.preventDefault();

          const email =
            loginForm.querySelector(
              '[name="email"]'
            )?.value.trim();

          const password =
            loginForm.querySelector(
              '[name="password"]'
            )?.value;

          try {

            await login(
              email,
              password
            );

            /*
              بعد نجاح الدخول:
              نذهب للموقع نفسه،
              وليس صفحة الربط.
            */

            if (
              !location.pathname.endsWith(
                'index.html'
              )
            ) {
              location.href =
                'index.html';
            }

          } catch (error) {

            notify(
              error.message,
              'error'
            );
          }
        }
      );
    }

    const registerForm =
      $('#register-form') ||
      $('[data-register-form]');

    if (registerForm) {

      registerForm.addEventListener(
        'submit',
        async event => {

          event.preventDefault();

          const username =
            registerForm.querySelector(
              '[name="username"]'
            )?.value.trim();

          const email =
            registerForm.querySelector(
              '[name="email"]'
            )?.value.trim();

          const password =
            registerForm.querySelector(
              '[name="password"]'
            )?.value;

          try {

            await register(
              username,
              email,
              password
            );

            location.href =
              'index.html';

          } catch (error) {

            notify(
              error.message,
              'error'
            );
          }
        }
      );
    }
  }

  /* =========================
     تشغيل
  ========================= */

  async function init() {

    initNavigation();
    initMobileMenu();
    initTheme();
    initSearch();
    initAuthForms();

    await loadCurrentUser();

    renderAuthState();

    /*
      الصفحة الداخلية:
      لا نسمح بعرضها بدون جلسة.
    */

    if (
      !document.querySelector(
        '[data-auth-page]'
      )
    ) {

      if (!state.user) {

        /*
          إذا الصفحة الحالية هي الموقع
          فعلًا، ارجع للدخول.
        */

        const path =
          location.pathname;

        if (
          path.endsWith(
            'index.html'
          ) ||
          path === '/' ||
          path === ''
        ) {

          location.href =
            'auth.html';

          return;
        }
      }
    }

    if (state.user) {
      await loadNotifications();
    }
  }

  return {
    state,
    login,
    register,
    logout,
    loadCurrentUser,
    loadNotifications,
    requireAuth,
    showView,
    openModal,
    closeModals,
    notify
  };

})();

window.Afendina = Afendina;

document.addEventListener(
  'DOMContentLoaded',
  () => {
    Afendina
      .init?.()
      .catch(error => {
        console.error(
          'Afendina init error:',
          error
        );
      });
  }
);
/* ========================================================
   افـنـدツينا🥀🖤
   script.js — الجزء الثاني
======================================================== */

(() => {

  const app =
    window.Afendina;

  if (!app) return;

  const state =
    app.state;

  const $ =
    selector =>
      document.querySelector(
        selector
      );

  const $$ =
    selector =>
      [...document.querySelectorAll(
        selector
      )];

  const API =
    '/api';

  /* ======================================================
     API HELPER
  ====================================================== */

  async function api(
    endpoint,
    options = {}
  ) {

    const response =
      await fetch(
        API + endpoint,
        {
          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json',

            ...(options.headers || {})
          },

          ...options
        }
      );

    let data = {};

    try {
      data =
        await response.json();
    } catch {}

    if (!response.ok) {

      const error =
        new Error(
          data.message ||
          'تعذر تنفيذ الطلب.'
        );

      error.status =
        response.status;

      throw error;
    }

    return data;
  }

  /* ======================================================
     PROFILE
  ====================================================== */

  async function loadProfile() {

    if (!state.user) return null;

    try {

      const data =
        await api(
          '/profile'
        );

      const user =
        data.user ||
        data.profile;

      if (user) {

        state.user =
          user;

        renderProfile(
          user
        );
      }

      return user;

    } catch (error) {

      if (
        error.status !== 404
      ) {
        console.error(
          'profile:',
          error
        );
      }

      return null;
    }
  }

  function renderProfile(
    user
  ) {

    $$('[data-profile-name]')
      .forEach(
        el =>
          el.textContent =
            user.username ||
            user.name ||
            ''
      );

    $$('[data-profile-email]')
      .forEach(
        el =>
          el.textContent =
            user.email ||
            ''
      );

    $$('[data-profile-level]')
      .forEach(
        el =>
          el.textContent =
            Number(
              user.level || 1
            )
      );

    $$('[data-profile-xp]')
      .forEach(
        el =>
          el.textContent =
            Number(
              user.xp || 0
            )
      );

    $$('[data-profile-coins]')
      .forEach(
        el =>
          el.textContent =
            Number(
              user.coins || 0
            )
      );

    if (
      user.avatar
    ) {

      $$('[data-user-avatar]')
        .forEach(
          img => {

            img.src =
              user.avatar;

            img.alt =
              user.username ||
              'الصورة الشخصية';
          }
        );
    }
  }

  /* ======================================================
     MESSAGES
  ====================================================== */

  async function loadMessages(
    conversationId = ''
  ) {

    if (!state.user) return;

    try {

      const endpoint =
        conversationId
          ? `/messages?conversation=${encodeURIComponent(
              conversationId
            )}`
          : '/messages';

      const data =
        await api(
          endpoint
        );

      state.messages =
        Array.isArray(
          data.messages
        )
          ? data.messages
          : [];

      renderMessages();

    } catch (error) {

      /*
        404 = الـAPI لم يتم إنشاؤه بعد.
        لا نعرض رسائل وهمية.
      */

      if (
        error.status === 404
      ) {

        state.messages = [];

        renderMessages();

        return;
      }

      console.error(
        'messages:',
        error
      );
    }
  }

  function renderMessages() {

    const container =
      $('#messages-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.messages.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا توجد رسائل.</div>';

      updateMessageBadge(0);

      return;
    }

    state.messages
      .forEach(
        message => {

          const item =
            document.createElement(
              'div'
            );

          item.className =
            'message-item';

          const text =
            message.text ||
            message.message ||
            '';

          const sender =
            message.senderName ||
            message.username ||
            '';

          item.innerHTML = `
            <strong>${escapeHTML(sender)}</strong>
            <p>${escapeHTML(text)}</p>
          `;

          container.appendChild(
            item
          );
        }
      );

    const unread =
      state.messages
        .filter(
          message =>
            !message.read &&
            !message.isRead
        )
        .length;

    updateMessageBadge(
      unread
    );
  }

  function updateMessageBadge(
    count
  ) {

    $$('[data-message-count]')
      .forEach(
        el => {

          if (count > 0) {

            el.textContent =
              count;

            el.classList.remove(
              'hidden'
            );

          } else {

            el.textContent =
              '';

            el.classList.add(
              'hidden'
            );
          }
        }
      );
  }

  async function sendMessage(
    receiverId,
    text
  ) {

    if (
      !receiverId ||
      !text.trim()
    ) {

      app.notify(
        'اكتب الرسالة أولًا.',
        'error'
      );

      return;
    }

    try {

      const data =
        await api(
          '/messages',
          {
            method: 'POST',

            body:
              JSON.stringify({
                receiverId,
                text:
                  text.trim()
              })
          }
        );

      app.notify(
        data.message ||
        'تم إرسال الرسالة.',
        'success'
      );

      await loadMessages(
        receiverId
      );

    } catch (error) {

      if (
        error.status === 404
      ) {

        app.notify(
          'ميزة الرسائل لم يتم ربط API الخاص بها في السيرفر بعد.',
          'error'
        );

        return;
      }

      app.notify(
        error.message,
        'error'
      );
    }
  }

  /* ======================================================
     GIFTS
  ====================================================== */

  async function loadGifts() {

    if (!state.user) return;

    try {

      const data =
        await api(
          '/gifts'
        );

      state.gifts =
        Array.isArray(
          data.gifts
        )
          ? data.gifts
          : [];

      renderGifts();

    } catch (error) {

      /*
        لا نضع هدايا تجريبية.
      */

      state.gifts = [];

      renderGifts();

      if (
        error.status !== 404
      ) {
        console.error(
          'gifts:',
          error
        );
      }
    }
  }

  function renderGifts() {

    const container =
      $('#gifts-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.gifts.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا توجد هدايا متاحة حاليًا.</div>';

      return;
    }

    state.gifts
      .forEach(
        gift => {

          const item =
            document.createElement(
              'article'
            );

          item.className =
            'gift-item';

          const name =
            gift.name ||
            gift.title ||
            'هدية';

          const price =
            Number(
              gift.price ||
              gift.coins ||
              0
            );

          item.innerHTML = `
            <div class="gift-icon">
              ${escapeHTML(
                gift.icon ||
                '🎁'
              )}
            </div>

            <strong>
              ${escapeHTML(name)}
            </strong>

            <span>
              ${price} 🪙
            </span>

            <button
              type="button"
              data-send-gift="${escapeHTML(
                gift.id
              )}"
            >
              إرسال
            </button>
          `;

          container.appendChild(
            item
          );
        }
      );
  }

  async function sendGift(
    giftId,
    receiverId
  ) {

    if (
      !giftId ||
      !receiverId
    ) {

      app.notify(
        'حدد الهدية والمستخدم أولًا.',
        'error'
      );

      return;
    }

    try {

      const data =
        await api(
          '/gifts/send',
          {
            method: 'POST',

            body:
              JSON.stringify({
                giftId,
                receiverId
              })
          }
        );

      app.notify(
        data.message ||
        'تم إرسال الهدية.',
        'success'
      );

      await loadProfile();

    } catch (error) {

      if (
        error.status === 404
      ) {

        app.notify(
          'ميزة إرسال الهدايا تحتاج API حقيقي في server.js.',
          'error'
        );

        return;
      }

      app.notify(
        error.message,
        'error'
      );
    }
  }

  /* ======================================================
     FRIENDS
  ====================================================== */

  async function loadFriends() {

    if (!state.user) return;

    try {

      const data =
        await api(
          '/friends'
        );

      state.friends =
        Array.isArray(
          data.friends
        )
          ? data.friends
          : [];

      renderFriends();

    } catch (error) {

      state.friends = [];

      renderFriends();

      if (
        error.status !== 404
      ) {
        console.error(
          'friends:',
          error
        );
      }
    }
  }

  function renderFriends() {

    const container =
      $('#friends-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.friends.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا يوجد أصدقاء لعرضهم.</div>';

      return;
    }

    state.friends
      .forEach(
        friend => {

          const item =
            document.createElement(
              'div'
            );

          item.className =
            'friend-item';

          item.textContent =
            friend.username ||
            friend.name ||
            '';

          container.appendChild(
            item
          );
        }
      );
  }

  /* ======================================================
     LEADERBOARD
  ====================================================== */

  async function loadLeaderboard() {

    try {

      const data =
        await api(
          '/leaderboard'
        );

      state.leaderboard =
        Array.isArray(
          data.leaderboard
        )
          ? data.leaderboard
          : [];

      renderLeaderboard();

    } catch (error) {

      state.leaderboard = [];

      renderLeaderboard();

      if (
        error.status !== 404
      ) {
        console.error(
          'leaderboard:',
          error
        );
      }
    }
  }

  function renderLeaderboard() {

    const container =
      $('#leaderboard-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.leaderboard.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا يوجد ترتيب متاح.</div>';

      return;
    }

    state.leaderboard
      .forEach(
        (user, index) => {

          const item =
            document.createElement(
              'div'
            );

          item.className =
            'leaderboard-item';

          item.innerHTML = `
            <strong>
              #${index + 1}
            </strong>

            <span>
              ${escapeHTML(
                user.username ||
                user.name ||
                ''
              )}
            </span>

            <small>
              Level ${Number(
                user.level || 1
              )}
            </small>
          `;

          container.appendChild(
            item
          );
        }
      );
  }

  /* ======================================================
     ACHIEVEMENTS
  ====================================================== */

  async function loadAchievements() {

    try {

      const data =
        await api(
          '/achievements'
        );

      state.achievements =
        Array.isArray(
          data.achievements
        )
          ? data.achievements
          : [];

      renderAchievements();

    } catch (error) {

      state.achievements = [];

      renderAchievements();

      if (
        error.status !== 404
      ) {
        console.error(
          'achievements:',
          error
        );
      }
    }
  }

  function renderAchievements() {

    const container =
      $('#achievements-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.achievements.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا توجد إنجازات متاحة.</div>';

      return;
    }

    state.achievements
      .forEach(
        achievement => {

          const item =
            document.createElement(
              'article'
            );

          item.className =
            'achievement-item';

          item.innerHTML = `
            <strong>
              ${escapeHTML(
                achievement.name ||
                achievement.title ||
                ''
              )}
            </strong>

            <p>
              ${escapeHTML(
                achievement.description ||
                ''
              )}
            </p>
          `;

          container.appendChild(
            item
          );
        }
      );
  }

  /* ======================================================
     TASKS
  ====================================================== */

  async function loadTasks() {

    try {

      const data =
        await api(
          '/tasks'
        );

      state.tasks =
        Array.isArray(
          data.tasks
        )
          ? data.tasks
          : [];

      renderTasks();

    } catch (error) {

      state.tasks = [];

      renderTasks();

      if (
        error.status !== 404
      ) {
        console.error(
          'tasks:',
          error
        );
      }
    }
  }

  function renderTasks() {

    const container =
      $('#tasks-list');

    if (!container) return;

    container.innerHTML = '';

    if (
      state.tasks.length === 0
    ) {

      container.innerHTML =
        '<div class="empty-state">لا توجد مهام متاحة.</div>';

      return;
    }

    state.tasks
      .forEach(
        task => {

          const item =
            document.createElement(
              'article'
            );

          item.className =
            'task-item';

          item.innerHTML = `
            <strong>
              ${escapeHTML(
                task.title ||
                task.name ||
                ''
              )}
            </strong>

            <span>
              ${escapeHTML(
                task.description ||
                ''
              )}
            </span>

            <small>
              XP: ${Number(
                task.xp || 0
              )}
            </small>
          `;

          container.appendChild(
            item
          );
        }
      );
  }

  /* ======================================================
     SETTINGS
  ====================================================== */

  function initSettings() {

    $$('[data-logout]')
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {
              app.logout();
            }
          );
        }
      );

    $$('[data-theme-toggle]')
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              const light =
                document.body
                  .classList
                  .contains(
                    'light'
                  );

              localStorage.setItem(
                'afendina_theme',
                light
                  ? 'dark'
                  : 'light'
              );
            }
          );
        }
      );
  }

  /* ======================================================
     أزرار الهدايا
  ====================================================== */

  function initGiftButtons() {

    document.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '[data-send-gift]'
          );

        if (!button) return;

        const giftId =
          button.dataset.sendGift;

        const receiverId =
          button.dataset.receiverId ||
          $('#gift-receiver')?.value;

        sendGift(
          giftId,
          receiverId
        );
      }
    );
  }

  /* ======================================================
     تحديث البيانات
  ====================================================== */

  async function refreshAll() {

    if (!state.user) return;

    try {

      await loadProfile();

      await Promise.all([
        app.loadNotifications(),
        loadMessages(),
        loadGifts(),
        loadFriends(),
        loadLeaderboard(),
        loadAchievements(),
        loadTasks()
      ]);

    } catch (error) {

      console.error(
        'refresh:',
        error
      );
    }
  }

  /* ======================================================
     START
  ====================================================== */

  async function startFeatures() {

    initSettings();
    initGiftButtons();

    if (!state.user) {
      return;
    }

    await refreshAll();

    /*
      تحديث دوري للبيانات.
      لا يتم إنشاء أي بيانات جديدة من الواجهة.
    */

    setInterval(
      async () => {

        if (
          document.hidden ||
          !state.user
        ) {
          return;
        }

        await refreshAll();

      },
      30000
    );
  }

  /*
    انتظر حتى تكتمل تهيئة الجزء الأول.
  */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      startFeatures,
      { once: true }
    );

  } else {

    startFeatures();
  }

  /* ======================================================
     API عامة
  ====================================================== */

  window.AfendinaFeatures = {
    loadProfile,
    loadMessages,
    sendMessage,
    loadGifts,
    sendGift,
    loadFriends,
    loadLeaderboard,
    loadAchievements,
    loadTasks,
    refreshAll
  };

})();
