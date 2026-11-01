/** Format built-in navigation text without changing acronym or brand spelling. */
export function navigationLabel(label) {
  return label.replace(
    /(^|\s)(\p{L})/gu,
    (_, space, letter) => space + letter.toLocaleUpperCase(),
  );
}
