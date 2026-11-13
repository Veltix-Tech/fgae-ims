import { useEffect, useRef, useState } from 'react'
import { UploadSimpleIcon, XIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import { registrationService } from '@registration-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import { RegistrationError, validateDocument, type DocumentRule, type RegistrationDocument as Document, type RegistrationService } from '../../services/contracts/registration'
import type { TranslationKey } from '../../i18n/locales/en/auth'

export function RegistrationDocument({ rule, value, disabled, onChange, onBusy, service = registrationService, onFailure }: { rule: DocumentRule; value?: Document; disabled: boolean; onChange: (value?: Document) => void; onBusy: (busy: boolean) => void; service?: Pick<RegistrationService, 'upload' | 'preview'>; onFailure?: (failure: unknown) => void }) {
  const { t, locale } = useLocale()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [preview, setPreview] = useState<{ id: string; url: string; error: boolean }>({ id: '', url: '', error: false })
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const [candidate, setCandidate] = useState<File | null>(null)
  const active = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const busyCallback = useRef(onBusy)
  const failureCallback = useRef(onFailure)
  useEffect(() => { failureCallback.current = onFailure }, [onFailure])
  useEffect(() => { busyCallback.current = onBusy }, [onBusy])
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); busyCallback.current(false) } }, [])
  const docId = value?.id
  const url = preview.id === docId ? preview.url : ''
  const previewError = preview.id === docId && preview.error
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''
    if (docId) void service.preview(docId, controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setPreview({ id: docId, url: objectUrl, error: false }) }
    }).catch(failure => { if (!controller.signal.aborted) { setPreview({ id: docId, url: '', error: true }); failureCallback.current?.(failure) } })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [docId, previewAttempt, service])
  async function upload(file: File) {
    if (active.current) return
    setCandidate(file)
    const controller = new AbortController(); active.current = controller
    setError(null); setProgress(0); onBusy(true)
    try {
      await validateDocument(file, rule); controller.signal.throwIfAborted()
      const result = await service.upload(file, rule.id, controller.signal, setProgress)
      if (!controller.signal.aborted && alive.current) { onChange(result); setCandidate(null) }
    } catch (failure) {
      if (!controller.signal.aborted && alive.current) failureCallback.current?.(failure)
      if (alive.current) setError(controller.signal.aborted ? 'regUploadCancelled' : failure instanceof RegistrationError && failure.code === 'FILE_TYPE' ? 'regFileType' : failure instanceof RegistrationError && failure.code === 'FILE_SIZE' ? 'regFileSize' : 'regUploadFailed')
    } finally {
      active.current = null
      if (alive.current) { setProgress(null); onBusy(false); if (fileInput.current) fileInput.current.value = '' }
    }
  }
  return <section className="document-card" aria-labelledby={`document-${rule.id}`}>
    <h3 id={`document-${rule.id}`}>{rule.label[locale]} <span className="small-label">{t(rule.required ? 'regRequiredLabel' : 'regOptional')}</span></h3>
    <p className="field-hint" id={`file-hint-${rule.id}`}>{t('regFileHint').replace('{types}', rule.types.map(type => type.split('/')[1]!.toUpperCase()).join(', ')).replace('{size}', new Intl.NumberFormat(locale).format(rule.maxBytes / 1024 / 1024))}</p>
    {value && <div className="uploaded-file"><strong>{value.name}</strong><span>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value.size / 1024)} KB</span>
      {url && value.mime.startsWith('image/') && <img src={url} alt={t('regImageAlt').replace('{name}', value.name)} onError={() => setPreview({ id: value.id, url: '', error: true })} />}
      {url && <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">{t('regPreview')} <ArrowSquareOutIcon size={15} aria-hidden="true" /></a>}
      {previewError && <p role="status" className="field-error">{t('regPreviewUnavailable')} <Button className="text-button" onClick={() => setPreviewAttempt(old => old + 1)}>{t('resetRetry')}</Button></p>}
    </div>}
    <input className="sr-only" tabIndex={-1} ref={fileInput} type="file" id={`file-${rule.id}`} accept={rule.types.join(',')} aria-label={rule.label[locale]} aria-describedby={`file-hint-${rule.id}`} disabled={disabled || progress !== null} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
    {progress !== null ? <div className="upload-progress"><progress max={100} value={progress} aria-label={t('regUploading')} /><p role="status">{t('regUploadProgress').replace('{percent}', String(progress))}</p><Button className="secondary" onClick={() => active.current?.abort()}>{t('regCancelUpload')}</Button></div> :
      <div className="document-actions"><Button className="secondary" disabled={disabled} onClick={() => fileInput.current?.click()}><UploadSimpleIcon size={18} aria-hidden="true" />{t(value ? 'regReplace' : 'regUpload')}</Button>
        {value && <Button className="secondary" disabled={disabled} onClick={() => { onChange(); setCandidate(null); setError(null) }}><XIcon size={17} aria-hidden="true" />{t('regRemove')}</Button>}</div>}
    {error && <div className="field-error" role="alert">{t(error)}{candidate && progress === null && <Button className="text-button" disabled={disabled} onClick={() => void upload(candidate)}>{t('resetRetry')}</Button>}</div>}
  </section>
}
