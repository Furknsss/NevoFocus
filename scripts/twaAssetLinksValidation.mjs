export function isValidTwaAssetLinks(found, expected) {
  if (!Array.isArray(found) || !Array.isArray(expected) || !expected.length) return false;
  const requiredRelations = [
    'delegate_permission/common.handle_all_urls',
    'delegate_permission/common.use_as_origin',
  ];
  for (const relation of requiredRelations) {
    if (!found.some(row => row &&
      Array.isArray(row.relation) && row.relation.includes(relation) &&
      row.target?.namespace === 'android_app' &&
      row.target?.package_name === 'com.furknsss.nevofocus' &&
      expected.some(e => e.target?.package_name === 'com.furknsss.nevofocus' &&
        e.target?.sha256_cert_fingerprints?.some(fp =>
          row.target?.sha256_cert_fingerprints?.includes(fp))
      )
    )) return false;
  }
  return true;
}
