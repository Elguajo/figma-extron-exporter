// Match the authored suffix, not the generated key: keys can be manual or
// disambiguated. Case and prefix aliases do not change the author's intent.
export function popupNameSuffix(name:string):string|undefined {
  return /^(popupref|pr|popupgroup|pgrp|popup|pop|modalpopup|mdl)_(.+)$/i.exec(name)?.[2].toLowerCase();
}
