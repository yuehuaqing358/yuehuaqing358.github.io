(() => {
  'use strict';

  var DATA = window.BLOG_DATA || {};
  var POSTS = DATA.POSTS || [];
  var ABOUT = DATA.ABOUT || {};
  var PRODUCTS = DATA.PRODUCTS || [];
  var CONTACT = DATA.CONTACT || {};
  var SECRET_PASSWORD = 'elj2026';  /* ← 改这里换密码 */
  var SECRET_CONTENT = DATA.SECRET_CONTENT || '';
  var isSecretUnlocked = false;

  /* GitHub API 配置（用于保存隐藏页面内容） */
  var GITHUB_REPO = 'yuehuaqing358/yuehuaqing358.github.io';
  var GITHUB_BRANCH = 'main';
  var GITHUB_DATA_JS_PATH = 'js/data.js';

  function getGitHubToken() {
    return localStorage.getItem('gh_token') || '';
  }
  function setGitHubToken(t) {
    if (t) localStorage.setItem('gh_token', t);
    else localStorage.removeItem('gh_token');
  }

  /* 安全 base64 编解码（支持中文） */
  function utf8_to_b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64_to_utf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function parseMarkdown(md) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try { return marked.parse(md.trim()); } catch (e) {}
    }
    return md.trim()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .split('\n\n').map(function(block) {
        var t = block.trim();
        if (/^#{2,3}\s/.test(t)) return '<h3 style="margin-top:1.5em">' + t.replace(/^#{2,3}\s*/, '') + '</h3>';
        if (/^#\s/.test(t)) return '<h2 style="margin-top:1.5em">' + t.replace(/^#\s*/, '') + '</h2>';
        if (t.startsWith('---')) return '<hr>';
        if (t.startsWith('- ') || t.startsWith('* ')) return '<ul>' + t.split('\n').map(function(l) { return '<li>' + l.replace(/^[-*]\s*/, '') + '</li>'; }).join('') + '</ul>';
        if (/^\d+\.\s/.test(t)) return '<ol>' + t.split('\n').map(function(l) { return '<li>' + l.replace(/^\d+\.\s*/, '') + '</li>'; }).join('') + '</ol>';
        return '<p>' + t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
      }).join('\n');
  }

  function formatDate(s) {
    var d = new Date(s);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getAllTags() {
    var m = {};
    POSTS.forEach(function(p) { p.tags.forEach(function(t) { m[t] = (m[t] || 0) + 1; }); });
    return m;
  }

  function renderTag(tag, active) {
    return '<span class="tag' + (active ? ' active' : '') + '" data-tag="' + tag + '">' + tag + '</span>';
  }

  function renderPostCard(post) {
    return '<article class="post-card" data-id="' + post.id + '">' +
      '<div class="post-card-meta">' +
        '<span class="post-date">' + formatDate(post.date) + '</span>' +
        post.tags.map(function(t) { return renderTag(t); }).join('') +
      '</div>' +
      '<h3>' + post.title + '</h3>' +
      '<p>' + post.summary + '</p>' +
      '<div class="post-card-footer">' +
        '<span class="read-time">阅读约 ' + post.readTime + '</span>' +
        '<span style="font-size:12px;color:var(--primary)">阅读全文 →</span>' +
      '</div>' +
    '</article>';
  }

  /* ── 路由 ── */
  var NAV_PAGES = ['home', 'services', 'articles', 'contact'];
  var ALL_PAGES = NAV_PAGES.concat(['article', 'service', 'secret']);
  var currentPage = 'home';

  function showPage(name) {
    $$('.page').forEach(function(p) { p.classList.remove('active'); });
    var el = $('#page-' + name);
    if (el) el.classList.add('active');

    $$('.bottom-nav-item').forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('data-page') === name);
    });

    if (name === 'secret') renderSecret();

    currentPage = name;
    window.scrollTo(0, 0);
  }

  function navigate(name) {
    if (NAV_PAGES.indexOf(name) !== -1) {
      history.pushState({ page: name }, '', '#' + name);
    }
    showPage(name);
  }

  window.addEventListener('popstate', function(e) {
    var p = (e.state && e.state.page) || 'home';
    showPage(ALL_PAGES.indexOf(p) !== -1 ? p : 'home');
  });

  /* ── 绑定导航 ── */
  function bindNav() {
    $$('.bottom-nav-item').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        navigate(a.getAttribute('data-page'));
      });
    });

    var homeServicesCard = $('.home-services-card');
    if (homeServicesCard) {
      homeServicesCard.addEventListener('click', function(e) {
        e.preventDefault();
        navigate(homeServicesCard.getAttribute('data-page'));
      });
    }

  }

  /* ── 密码弹窗 ── */
  function showPwdModal() {
    var overlay = $('#pwd-overlay');
    if (!overlay) return;
    overlay.classList.add('show');
    var input = $('#pwd-input');
    if (input) { input.value = ''; input.focus(); }
    var err = $('#pwd-error');
    if (err) err.classList.remove('show');
  }

  function hidePwdModal() {
    var overlay = $('#pwd-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  function checkPassword() {
    var input = $('#pwd-input');
    if (!input) return;
    if (input.value === SECRET_PASSWORD) {
      isSecretUnlocked = true;
      hidePwdModal();
      navigate('secret');
    } else {
      var err = $('#pwd-error');
      if (err) err.classList.add('show');
      input.value = '';
      input.focus();
    }
  }

  /* ── 隐藏页面 ── */
  function renderSecret() {
    var container = $('#secret-content');
    if (!container) return;
    container.innerHTML = parseMarkdown(SECRET_CONTENT);
    var editBtn = $('#secret-edit-btn');
    if (editBtn) editBtn.style.display = isSecretUnlocked ? '' : 'none';
  }

  function editSecret() {
    var container = $('#secret-content');
    if (!container) return;
    var html = SECRET_CONTENT.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    container.innerHTML =
      '<textarea id="secret-editor" style="width:100%;height:60vh;padding:12px;border:1.5px solid var(--primary);border-radius:10px;font-size:14px;line-height:1.8;resize:vertical;outline:none;font-family:var(--font)">' + html + '</textarea>' +
      '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center">' +
        '<button id="secret-save-btn" class="pwd-btn" style="width:auto;padding:10px 28px;margin:0">保存</button>' +
        '<button id="secret-cancel-btn" class="pwd-cancel" style="margin:0">取消</button>' +
      '</div>';
    $('#secret-save-btn').addEventListener('click', saveSecret);
    $('#secret-cancel-btn').addEventListener('click', renderSecret);
  }

  function saveSecret() {
    var token = getGitHubToken();
    if (!token) {
      token = prompt('请输入 GitHub Token（仅保存在本浏览器，不会上传）：');
      if (!token) return;
      setGitHubToken(token);
      token = getGitHubToken();
    }
    var editor = $('#secret-editor');
    if (!editor) return;
    var newContent = editor.value;
    var saveBtn = $('#secret-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }
    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_DATA_JS_PATH, {
      headers: { 'Authorization': 'token ' + token, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.content) throw new Error('无法读取 data.js');
      var sha = data.sha;
      var jsContent = b64_to_utf8(data.content);
      var lines = jsContent.split('\n');
      var startIdx = -1, endIdx = -1;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('/* SECRET_CONTENT_START */') !== -1) startIdx = i;
        if (startIdx !== -1 && lines[i].indexOf('/* SECRET_CONTENT_END */') !== -1) { endIdx = i; break; }
      }
      if (startIdx === -1 || endIdx === -1) throw new Error('data.js 格式错误：找不到标记');
      var escaped = newContent.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\${/g,'\\${');
      lines = lines.slice(0, startIdx + 1).concat(['const SECRET_CONTENT = `' + escaped + '`;'], lines.slice(endIdx));
      var newJs = lines.join('\n');
      return fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_DATA_JS_PATH, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ message: '更新隐藏页面内容', content: utf8_to_b64(newJs), sha: sha, branch: GITHUB_BRANCH })
      });
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.commit) { SECRET_CONTENT = newContent; renderSecret(); alert('保存成功！'); }
      else throw new Error(data.message || '保存失败');
    })
    .catch(function(err){ console.error(err); alert('保存失败：' + (err.message || '请重试')); })
    .finally(function(){ var b = $('#secret-save-btn'); if (b) { b.disabled = false; b.textContent = '保存'; } });
  }

  /* 双击头像绑定已在 renderContact 中处理 */
  function bindAvatarDblClick() {
    var avatar = $('.contact-avatar');
    if (avatar) {
      avatar.style.cursor = 'default';
      avatar.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showPwdModal();
      });
    }
  }

  /* ── 服务页 ── */
  function renderServices() {
    var container = $('#services-list');
    if (!container) return;
    container.innerHTML = PRODUCTS.map(function(p) {
      var featuresHtml = (p.features || []).map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');

      return '<div class="service-card">' +
        '<div class="service-card-header">' +
          '<span class="service-icon">' + (p.icon || '') + '</span>' +
          '<h4>' + p.name + '</h4>' +
        '</div>' +
        '<p class="service-desc">' + p.desc + '</p>' +
        (featuresHtml ? '<ul class="service-features">' + featuresHtml + '</ul>' : '') +
        '<div class="service-card-footer">' +
          '<div class="service-price">' +
            '<span class="price-symbol">¥</span>' +
            '<span class="price-num">' + p.price + '</span>' +
            '<span class="price-unit">' + p.priceUnit + '</span>' +
          '</div>' +
          '<a class="service-cta">' + (p.cta || '预约咨询') + ' →</a>' +
        '</div>' +
      '</div>';
    }).join('');

    $$('.service-cta', container).forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        navigate('contact');
      });
    });
  }

  /* ── 文章页 ── */
  var activeFilter = null;

  function renderArticles(filterTag) {
    activeFilter = filterTag || null;
    var container = $('#all-posts');
    if (!container) return;

    var filtered = filterTag ? POSTS.filter(function(p) { return p.tags.indexOf(filterTag) !== -1; }) : POSTS;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty">暂无文章，敬请期待…</div>';
      return;
    }
    container.innerHTML = filtered.map(renderPostCard).join('');
    bindPostCards(container);

    $$('#filter-chips .tag').forEach(function(c) {
      c.classList.toggle('active', c.getAttribute('data-tag') === (filterTag || ''));
    });
  }

  function bindPostCards(container) {
    $$('.post-card', container).forEach(function(card) {
      card.addEventListener('click', function(e) {
        var tagEl = e.target.closest('.tag');
        if (tagEl) {
          e.stopPropagation();
          renderArticles(tagEl.getAttribute('data-tag'));
          return;
        }
        openArticle(parseInt(card.getAttribute('data-id'), 10));
      });
    });
  }

  function buildFilterChips() {
    var wrap = $('#filter-chips');
    if (!wrap) return;
    var tags = getAllTags();
    var sorted = Object.keys(tags).sort(function(a, b) { return tags[b] - tags[a]; });
    wrap.innerHTML = '<span class="tag" data-tag="">全部</span>' +
      sorted.map(function(t) { return '<span class="tag" data-tag="' + t + '">' + t + '</span>'; }).join('');
    $$('.tag', wrap).forEach(function(el) {
      el.addEventListener('click', function() {
        renderArticles(el.getAttribute('data-tag') || null);
      });
    });
  }

  function bindSearch() {
    var inp = $('#search-input');
    if (!inp) return;
    inp.addEventListener('input', function() {
      var q = inp.value.trim().toLowerCase();
      if (!q) { renderArticles(activeFilter); return; }
      var filtered = POSTS.filter(function(p) {
        return p.title.toLowerCase().indexOf(q) !== -1 ||
               p.summary.toLowerCase().indexOf(q) !== -1 ||
               p.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
      });
      var container = $('#all-posts');
      container.innerHTML = filtered.length
        ? filtered.map(renderPostCard).join('')
        : '<div class="empty">没有找到"' + q + '"相关的文章</div>';
      if (filtered.length) bindPostCards(container);
    });
  }

  /* ── 文章详情 ── */
  function openArticle(id) {
    var post = POSTS.filter(function(p) { return p.id === id; })[0];
    if (!post) return;

    var html = parseMarkdown(post.content);
    var toc = buildTOC(post.content);

    $('#article-container').innerHTML =
      '<button class="back-btn" id="btn-back">← 返回</button>' +
      '<div class="article-header">' +
        '<h1 class="article-title">' + post.title + '</h1>' +
        '<div class="article-meta">' +
          '<span>' + formatDate(post.date) + '</span><span>·</span>' +
          '<span>阅读约 ' + post.readTime + '</span><span>·</span>' +
          post.tags.map(function(t) { return renderTag(t); }).join('') +
        '</div>' +
      '</div>' +
      (toc ? '<div class="toc"><div class="toc-title">目录</div>' + toc + '</div>' : '') +
      '<div class="md-content">' + html + '</div>';

    $('#btn-back').addEventListener('click', function() {
      history.back();
      setTimeout(function() { if (currentPage === 'article') navigate('articles'); }, 100);
    });

    navigate('article');
  }

  /* ── 服务详情 ── */
  function openService(id) {
    var service = PRODUCTS.filter(function(p) { return p.id === id; })[0];
    if (!service) return;

    var html = parseMarkdown(service.content);

    $('#service-container').innerHTML =
      '<button class="back-btn" id="btn-svc-back">← 返回</button>' +
      '<div class="article-header"><h1 class="article-title">' + service.name + '</h1></div>' +
      '<div class="md-content">' + html + '</div>';

    $('#btn-svc-back').addEventListener('click', function() {
      history.back();
      setTimeout(function() { if (currentPage === 'service') navigate('services'); }, 100);
    });

    navigate('service');
  }

  function buildTOC(md) {
    var headings = [];
    md.split('\n').forEach(function(line) {
      var m = line.match(/^(#{2,3})\s+(.+)/);
      if (m) headings.push({ level: m[1].length, text: m[2].trim() });
    });
    if (headings.length < 2) return '';
    return '<ul>' + headings.map(function(h) {
      return '<li' + (h.level === 3 ? ' style="margin-left:1em"' : '') + '>' + h.text + '</li>';
    }).join('') + '</ul>';
  }

  /* ── 联系页 ── */
  function renderContact() {
    var container = $('#contact-full');
    if (!container) return;

    var bioHtml = ABOUT.bio ? ABOUT.bio.split('\n\n').map(function(p) { return '<p>' + p + '</p>'; }).join('') : '';

    container.innerHTML =
      '<div class="contact-bio-card">' +
        '<div class="contact-avatar">' + (ABOUT.name || 'E')[0] + '</div>' +
        '<div class="contact-name">' + (ABOUT.name || '') + '</div>' +
        '<div class="contact-role">' + (ABOUT.title || '') + '</div>' +
        '<div class="contact-bio-text">' + bioHtml + '</div>' +
      '</div>' +
      '<div class="contact-cards">' +
        '<div class="contact-card">' +
          '<span class="contact-card-icon wechat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/></svg></span>' +
          '<div class="contact-card-body"><span class="contact-card-label">微信</span><span class="contact-card-value">' + (CONTACT.wechat || '') + '</span></div>' +
        '</div>' +
        '<div class="contact-card">' +
          '<span class="contact-card-icon oa-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4"/></svg></span>' +
          '<div class="contact-card-body"><span class="contact-card-label">公众号</span><span class="contact-card-value">' + (CONTACT.official_account || '') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="contact-note">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        (CONTACT.intro || '') +
      '</div>';

    bindAvatarDblClick();
  }

  /* ── 初始化 ── */
  function init() {
    bindNav();
    renderServices();
    buildFilterChips();
    renderArticles();
    bindSearch();
    renderContact();

    // 密码弹窗事件
    var pwdBtn = $('#pwd-btn');
    if (pwdBtn) pwdBtn.addEventListener('click', checkPassword);

    var pwdInput = $('#pwd-input');
    if (pwdInput) pwdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') checkPassword();
    });

    var pwdCancel = $('#pwd-cancel');
    if (pwdCancel) pwdCancel.addEventListener('click', hidePwdModal);

    var pwdOverlay = $('#pwd-overlay');
    if (pwdOverlay) pwdOverlay.addEventListener('click', function(e) {
      if (e.target === pwdOverlay) hidePwdModal();
    });

    var secretBack = $('#secret-back');
    if (secretBack) secretBack.addEventListener('click', function() { navigate('contact'); });

    // 隐藏页面编辑按钮
    var editBtn = $('#secret-edit-btn');
    if (editBtn) editBtn.addEventListener('click', editSecret);

    var hash = (location.hash || '').replace('#', '') || 'home';
    showPage(ALL_PAGES.indexOf(hash) !== -1 ? hash : 'home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
