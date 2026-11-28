import { useLocale } from '../../i18n/locale'
import type { FacilityValues, FacilitySnapshot } from '../../services/contracts/facilities'
export function FacilityFacts({value,snapshot}:{value:FacilityValues;snapshot:FacilitySnapshot}) {
  const {t}=useLocale(); const branch=snapshot.branches.find(b=>b.id===value.branchId);const area=snapshot.areas.find(a=>a.id===branch?.areaId)
  return <dl className="portfolio-facts">
    <div><dt>{t('facilityName')}</dt><dd>{value.name}</dd></div><div><dt>{t('facilityCode')}</dt><dd>{value.code}</dd></div>
    <div><dt>{t('facilityStatus')}</dt><dd>{t(value.state==='ACTIVE'?'orgActive':'orgArchived')}</dd></div>
    <div><dt>{t('facilityBranch')}</dt><dd>{branch?<a className="text-link" href={`/branches/${encodeURIComponent(branch.id)}`}>{branch.name}</a>:<span>{t('facilityHistoricalBranch')}: {value.branchId}</span>}</dd></div>
    {area&&<div><dt>{t('branchParent')}</dt><dd><a className="text-link" href={`/areas/${encodeURIComponent(area.id)}`}>{area.name}</a></dd></div>}
    <div className="area-description"><dt>{t('facilityAddress')}</dt><dd>{value.address||t('facilityNoAddress')}</dd></div>
  </dl>
}
