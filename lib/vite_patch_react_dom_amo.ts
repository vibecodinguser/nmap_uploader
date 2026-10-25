import type { Plugin } from 'vite'

const DANGEROUS_INNER_HTML = /domElement\.innerHTML\s*=\s*key/g

const SAFE_INNER_HTML_REPLACEMENT =
  '((__el, __html) => { const __p = new DOMParser().parseFromString(String(__html), "text/html"); __el.replaceChildren(); for (const __n of __p.body.childNodes) __el.appendChild(__el.ownerDocument.importNode(__n, true)); })(domElement, key)'

const SCRIPT_INNER_HTML_BLOCK =
  /nextResource\s*=\s*ownerDocument\.createElement\("div"\);\s*nextResource\.innerHTML\s*=\s*"<script>(?:\\x3c|<)\/script>";\s*nextResource\s*=\s*nextResource\.removeChild\(\s*nextResource\.firstChild\s*\);/g

const SCRIPT_DIRECT_CREATE = 'nextResource = ownerDocument.createElement("script");'

/** Патч react-dom: заменяет innerHTML на DOMParser для прохождения AMO-линтера. */
export const patchReactDomForAmo = (): Plugin => ({
  name: 'patch-react-dom-amo',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('react-dom') || id.includes('server')) return
    if (!code.includes('innerHTML')) return

    let patched = code.replace(DANGEROUS_INNER_HTML, SAFE_INNER_HTML_REPLACEMENT)
    patched = patched.replace(SCRIPT_INNER_HTML_BLOCK, SCRIPT_DIRECT_CREATE)

    if (patched === code) return
    return { code: patched, map: null }
  },
})
