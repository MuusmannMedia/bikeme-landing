'use client';
import Link from 'next/link';
import {useCatalogCard} from './catalog-provider';
import {FramedBlob} from '../club-private-images';
import {visitText,visitMemberCount} from '@/lib/clubs/visits/i18n';
import {getAppDictionary} from '@/lib/app-i18n';
import type {VisitSnapshot} from '@/lib/clubs/visits/contract';
import type {ClubCatalogEntry} from '@/lib/clubs/types';
import type {Locale} from '@/lib/locales';
export function VisitCatalogCard({entry,locale}:{entry:ClubCatalogEntry;locale:Locale}){const{state:s,ref,retry}=useCatalogCard(entry.id),v=s.data?.snapshot as VisitSnapshot|undefined,p=v?.profile,t=getAppDictionary(locale),path=`/${locale}/app/clubs/${entry.id}`;
 return <article ref={ref} className="bike-app-club-card" data-visit-card={s.status} style={s.concealed?{visibility:'hidden'}:undefined}>
 <div className="bike-app-club-card-media">{p?<div className="bike-app-club-image-header">{s.data?.cover?<FramedBlob blob={s.data.cover} frame={p.cover_frame} slot="cover" label={visitText(locale,'cover')}/>:null}{s.data?.logo?<FramedBlob blob={s.data.logo} frame={p.logo_frame} slot="logo" label={visitText(locale,'logo')}/>:null}</div>:<div className="bike-app-club-catalog-cover" aria-hidden="true"><span>{Array.from(entry.name)[0]}</span></div>}</div>
 <div className="bike-app-club-card-copy"><span className="bike-app-chip">{p?visitText(locale,'title'):s.status==='access'?t('clubs.membersOnly'):s.status==='error'?t('clubs.loadError'):visitText(locale,'loading')}</span><h2><Link prefetch={false} href={path}>{p?.name??entry.name}</Link></h2>{p?<><p className="bike-app-club-card-description">{p.description}</p>{p.member_count!==null?<p className="bike-app-muted">{visitMemberCount(locale,p.member_count)}</p>:null}</>:null}
 {s.waiting&&!s.data?<p role="status" className="bike-app-muted">{visitText(locale,'catalogWaiting')}</p>:null}
 {s.status==='error'?<div role="alert"><p>{s.error==='quota'?visitText(locale,'quota'):t('clubs.loadError')}</p><button className="bike-app-button bike-app-button-secondary" onClick={retry}>{t('common.retry')}</button></div>:null}
 <div className="bike-app-club-card-footer"><Link prefetch={false} className="bike-app-button bike-app-button-secondary bike-app-button-small" href={path}>{t('clubs.open')}<span className="sr-only">: {entry.name}</span></Link></div></div></article>;
}
