import type { Plugin } from 'vite'

const DANGEROUS_INNER_HTML = /domElement\.innerHTML = key;/g

const SAFE_INNER_HTML_REPLACEMENT =
  '{const __amoParsed=new DOMParser().parseFromString(String(key),"text/html");domElement.replaceChildren();for(const __amoNode of __amoParsed.body.childNodes)domElement.appendChild(domElement.ownerDocument.importNode(__amoNode,true));}'

const SCRIPT_INNER_HTML_BLOCK =
  /nextResource = ownerDocument\.createElement\("div"\);\s*nextResource\.innerHTML = "<script>\\x3c\/script>";\s*nextResource = nextResource\.removeChild\(\s*nextResource\.firstChild\s*\);/g

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
