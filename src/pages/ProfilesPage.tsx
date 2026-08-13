import { useState } from 'react'
import { Button, Card, Input, Modal } from '../components'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'

export function ProfilesPage() {
  const {
    profiles,
    selectProfile,
    createProfile,
    deleteProfile,
    renameProfile,
    resetActiveProfile,
    saveActiveProfile,
    dirty,
  } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const target = profiles.profiles.find((p) => p.id === targetId)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('profiles.kicker')}</p>
          <h1 className="page-title">{t('profiles.title')}</h1>
          <p className="page-desc">{t('profiles.desc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              void saveActiveProfile().then(() =>
                toast.push({ title: t('common.profileSaved'), tone: 'success' }),
              )
            }}
          >
            {t('profiles.saveChanges')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setName(t('profiles.newName'))
              setCreateOpen(true)
            }}
          >
            {t('profiles.create')}
          </Button>
        </div>
      </div>

      <Card>
        <div className="profile-list">
          {profiles.profiles.map((profile) => {
            const active = profile.id === profiles.selectedProfileId
            return (
              <div
                key={profile.id}
                className="profile-item"
                data-active={active}
                onClick={() => {
                  void selectProfile(profile.id)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void selectProfile(profile.id)
                }}
              >
                <div>
                  <strong>{profile.name}</strong>
                  <div className="field-hint">{active ? t('common.active') : profile.id}</div>
                </div>
                <div className="profile-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTargetId(profile.id)
                      setName(profile.name)
                      setRenameOpen(true)
                    }}
                  >
                    {t('common.rename')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void resetActiveProfile().then(() =>
                        toast.push({ title: t('profiles.reset'), tone: 'success' }),
                      )
                    }}
                    disabled={!active}
                  >
                    {t('common.reset')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={profile.id === 'default'}
                    onClick={() => {
                      setTargetId(profile.id)
                      setDeleteOpen(true)
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Modal
        open={createOpen}
        title={t('profiles.createTitle')}
        confirmLabel={t('common.create')}
        cancelLabel={t('common.cancel')}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => {
          void createProfile(name).then(() => {
            setCreateOpen(false)
            toast.push({ title: t('profiles.created'), tone: 'success' })
          })
        }}
      >
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>

      <Modal
        open={renameOpen}
        title={t('profiles.renameTitle')}
        confirmLabel={t('common.rename')}
        cancelLabel={t('common.cancel')}
        onClose={() => setRenameOpen(false)}
        onConfirm={() => {
          if (!targetId) return
          void renameProfile(targetId, name).then(() => {
            setRenameOpen(false)
            toast.push({ title: t('profiles.renamed'), tone: 'success' })
          })
        }}
      >
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>

      <Modal
        open={deleteOpen}
        title={t('profiles.deleteTitle')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!targetId) return
          void deleteProfile(targetId).then(() => {
            setDeleteOpen(false)
            toast.push({ title: t('profiles.deleted') })
          })
        }}
      >
        {t('profiles.deleteBody', { name: target?.name ?? '' })}
      </Modal>
    </div>
  )
}
