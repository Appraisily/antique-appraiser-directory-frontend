const ENV_KEYS = [
  'GTM_ID',
  'GOOGLE_TAG_MANAGER_ID',
  'DIRECTORY_GTM_ID',
  'VITE_GTM_ID'
];

let cachedGtmId;

export function getGtmId() {
  if (cachedGtmId) {
    return cachedGtmId;
  }

  const key = ENV_KEYS.find((envKey) => {
    const value = process.env[envKey];
    return typeof value === 'string' && value.trim().length > 0;
  });

  if (!key) {
    cachedGtmId = 'GTM-PSLHDGM';
    return cachedGtmId;
  }

  cachedGtmId = process.env[key].trim() || 'GTM-PSLHDGM';
  return cachedGtmId;
}

export function getGtmHeadSnippet(id = getGtmId()) {
  return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');</script>
<!-- End Google Tag Manager -->`;
}

export function getGtmBodySnippet(id = getGtmId()) {
  return `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
}
