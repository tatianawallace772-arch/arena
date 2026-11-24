/* Dubuntu — interactive layer */
(function(){
  "use strict";

  /* Header shadow */
  var header = document.querySelector('.site-header');
  function onScroll(){
    if(!header) return;
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* Mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? '✕' : '☰';
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('open'); });
    });
  }

  /* Search overlay */
  var searchBtn = document.querySelector('.search-btn');
  var overlay = document.querySelector('.search-overlay');
  var searchInput = document.querySelector('#site-search');
  var resultsBox = document.querySelector('.search-results');
  var SEARCH_INDEX = [
    {title:'Home — Dubuntu 26.04 LTS', url:'/', desc:'Download, features and editions'},
    {title:'Download Dubuntu', url:'/download', desc:'ISOs, checksums, mirrors and system requirements'},
    {title:'Desktop', url:'/desktop', desc:'GNOME, Dub Shell, terminal and software'},
    {title:'Server & Cloud', url:'/server', desc:'Server, WSL, ARM and cloud images'},
    {title:'Community', url:'/community', desc:'Contribute, forums, roadmap and support'},
    {title:'FAQ', url:'/#faq', desc:'Is Dubuntu official? Is it free? How do I install?'}
  ];
  function renderResults(q){
    if(!resultsBox) return;
    q = (q||'').trim().toLowerCase();
    var list = SEARCH_INDEX.filter(function(i){
      return !q || i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q);
    });
    resultsBox.innerHTML = list.length
      ? list.map(function(i){ return '<a href="'+i.url+'"><b>'+i.title+'</b><br><small>'+i.desc+'</small></a>'; }).join('')
      : '<p style="padding:12px;color:#666">No results. Try “download”, “desktop” or “server”.</p>';
  }
  if(searchBtn && overlay){
    searchBtn.addEventListener('click', function(){
      overlay.classList.add('open');
      renderResults('');
      setTimeout(function(){ if(searchInput) searchInput.focus(); }, 50);
    });
    overlay.addEventListener('click', function(e){ if(e.target === overlay) overlay.classList.remove('open'); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') overlay.classList.remove('open');
      if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); overlay.classList.add('open'); renderResults(''); if(searchInput) searchInput.focus(); }
    });
    if(searchInput) searchInput.addEventListener('input', function(){ renderResults(searchInput.value); });
  }

  /* Reveal on scroll */
  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold:.12});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* FAQ accordion */
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q = item.querySelector('.faq-q');
    if(!q) return;
    q.addEventListener('click', function(){
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
      var icon = q.querySelector('span:last-child');
      if(icon) icon.textContent = open ? '−' : '+';
    });
  });

  /* Tabs */
  document.querySelectorAll('[data-tabs]').forEach(function(group){
    var btns = group.querySelectorAll('.tab-btn');
    var panels = document.querySelectorAll(group.getAttribute('data-tabs'));
    btns.forEach(function(btn){
      btn.addEventListener('click', function(){
        btns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        panels.forEach(function(p){ p.classList.remove('active'); });
        var target = document.querySelector(btn.getAttribute('data-target'));
        if(target) target.classList.add('active');
      });
    });
  });

  /* Terminal typing */
  var termLine = document.querySelector('#typed-line');
  if(termLine){
    var lines = [
      'sudo apt update && sudo apt upgrade',
      'dub --version  # Dubuntu 26.04 LTS “Dub Jam”',
      'snap install dub-store',
      'flatpak install flathub org.dubuntu.Music',
      'echo "Welcome to Dubuntu — turn it up."'
    ];
    var li = 0, ci = 0, deleting = false;
    function type(){
      var current = lines[li];
      termLine.textContent = current.slice(0, ci);
      var delay = deleting ? 18 : 42;
      if(!deleting && ci < current.length){ ci++; setTimeout(type, delay); }
      else if(!deleting && ci === current.length){ deleting = true; setTimeout(type, 1600); }
      else if(deleting && ci > 0){ ci--; setTimeout(type, delay); }
      else { deleting = false; li = (li+1) % lines.length; setTimeout(type, 350); }
    }
    type();
  }

  /* Copy buttons */
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = document.querySelector(btn.getAttribute('data-copy'));
      var text = target ? target.innerText : btn.getAttribute('data-copy-text') || '';
      function done(){ btn.textContent = 'Copied ✓'; setTimeout(function(){ btn.textContent = 'Copy'; }, 1600); }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done).catch(function(){ fallback(); });
      } else fallback();
      function fallback(){
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(e){}
        document.body.removeChild(ta); done();
      }
    });
  });

  /* Download edition selector */
  var EDITIONS = {
    desktop: {
      name:'Dubuntu Desktop 26.04 LTS — “Dub Jam”',
      file:'dubuntu-26.04-desktop-amd64.iso',
      size:'5.2 GB',
      sha:'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      arch:'amd64 (Intel / AMD 64-bit)',
      min:'4 GB RAM · 25 GB disk · 2 GHz dual-core',
      url:'https://releases.dubuntu.org/26.04/dubuntu-26.04-desktop-amd64.iso'
    },
    server: {
      name:'Dubuntu Server 26.04 LTS — “Dub Jam”',
      file:'dubuntu-26.04-server-amd64.iso',
      size:'2.8 GB',
      sha:'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1',
      arch:'amd64 (Intel / AMD 64-bit)',
      min:'2 GB RAM · 10 GB disk · 1 GHz',
      url:'https://releases.dubuntu.org/26.04/dubuntu-26.04-server-amd64.iso'
    },
    arm: {
      name:'Dubuntu ARM64 26.04 LTS — “Dub Jam”',
      file:'dubuntu-26.04-arm64.iso',
      size:'4.6 GB',
      sha:'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2',
      arch:'arm64 (Raspberry Pi, Apple Silicon VM, ARM servers)',
      min:'4 GB RAM · 25 GB disk · ARM64',
      url:'https://releases.dubuntu.org/26.04/dubuntu-26.04-arm64.iso'
    },
    wsl: {
      name:'Dubuntu WSL — Windows Subsystem for Linux',
      file:'dubuntu-wsl-26.04.msixbundle',
      size:'1.1 GB',
      sha:'d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3',
      arch:'Windows 10/11 · WSL2',
      min:'4 GB RAM · WSL2 enabled',
      url:'https://releases.dubuntu.org/26.04/dubuntu-wsl-26.04.msixbundle'
    }
  };
  var editionBtns = document.querySelectorAll('[data-edition]');
  var dlName = document.querySelector('#dl-name');
  var dlFile = document.querySelector('#dl-file');
  var dlSize = document.querySelector('#dl-size');
  var dlArch = document.querySelector('#dl-arch');
  var dlSha = document.querySelector('#dl-sha');
  var dlMin = document.querySelector('#dl-min');
  var dlBtn = document.querySelector('#dl-button');
  var dlMirror = document.querySelector('#dl-mirror');
  var MIRRORS = {
    global:'https://releases.dubuntu.org/26.04/',
    us:'https://us-mirror.dubuntu.org/26.04/',
    eu:'https://eu-mirror.dubuntu.org/26.04/',
    asia:'https://asia-mirror.dubuntu.org/26.04/'
  };
  var currentEdition = 'desktop';
  function applyEdition(key){
    currentEdition = key;
    var e = EDITIONS[key];
    if(!e) return;
    if(dlName) dlName.textContent = e.name;
    if(dlFile) dlFile.textContent = e.file;
    if(dlSize) dlSize.textContent = e.size;
    if(dlArch) dlArch.textContent = e.arch;
    if(dlSha) dlSha.textContent = e.sha;
    if(dlMin) dlMin.textContent = e.min;
    if(dlBtn) dlBtn.href = (dlMirror && MIRRORS[dlMirror.value]) ? MIRRORS[dlMirror.value] + e.file : e.url;
    editionBtns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-edition') === key); });
  }
  editionBtns.forEach(function(btn){
    btn.addEventListener('click', function(){ applyEdition(btn.getAttribute('data-edition')); });
  });
  if(dlMirror) dlMirror.addEventListener('change', function(){ applyEdition(currentEdition); });
  if(dlName) applyEdition('desktop');

  /* Checksum verifier */
  var verifyInput = document.querySelector('#verify-input');
  var verifyBtn = document.querySelector('#verify-btn');
  var verdict = document.querySelector('#verify-verdict');
  function verify(){
    if(!verifyInput || !verdict) return;
    var expected = (dlSha ? dlSha.textContent : '').trim().toLowerCase();
    var given = verifyInput.value.trim().toLowerCase().replace(/\s+/g,'');
    verdict.className = 'verdict ' + (given === expected ? 'ok' : 'bad');
    verdict.textContent = given === expected
      ? '✓ Checksum matches. Your download is authentic.'
      : '✗ Checksum does not match. Do not install — re-download from an official mirror.';
  }
  if(verifyBtn) verifyBtn.addEventListener('click', verify);
  if(verifyInput) verifyInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') verify(); });

  /* System requirements checker */
  var ram = document.querySelector('#req-ram');
  var cpu = document.querySelector('#req-cpu');
  var disk = document.querySelector('#req-disk');
  var reqVerdict = document.querySelector('#req-verdict');
  function checkReq(){
    if(!ram || !cpu || !disk || !reqVerdict) return;
    var r = +ram.value, c = +cpu.value, d = +disk.value;
    document.querySelector('#req-ram-val').textContent = r + ' GB RAM';
    document.querySelector('#req-cpu-val').textContent = c + ' GHz';
    document.querySelector('#req-disk-val').textContent = d + ' GB disk';
    var ok = r >= 4 && c >= 2 && d >= 25;
    var tight = r >= 2 && c >= 1 && d >= 10;
    reqVerdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
    reqVerdict.textContent = ok
      ? '✓ Great — your PC meets the recommended specs for Dubuntu Desktop.'
      : tight
        ? '⚠ You can run Dubuntu Server / Minimal, but Desktop will feel tight. Consider 4 GB RAM and 25 GB free disk.'
        : '✗ Below minimum. Try Dubuntu Minimal or a lightweight edition — see Server & Cloud.';
  }
  [ram,cpu,disk].forEach(function(el){ if(el) el.addEventListener('input', checkReq); });
  if(ram) checkReq();

  /* Countdown to next release (Dub Jam Point Release) */
  var cd = document.querySelector('#countdown');
  if(cd){
    var target = new Date('2026-12-15T00:00:00Z').getTime();
    function tick(){
      var diff = Math.max(0, target - Date.now());
      var days = Math.floor(diff / 86400000);
      var hrs = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      var secs = Math.floor((diff % 60000) / 1000);
      cd.textContent = days + 'd ' + hrs + 'h ' + mins + 'm ' + secs + 's';
    }
    tick(); setInterval(tick, 1000);
  }

  /* Footer year */
  var yr = document.querySelector('#year');
  if(yr) yr.textContent = new Date().getFullYear();
})();
