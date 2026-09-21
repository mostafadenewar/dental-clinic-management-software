import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  CloudArrowUp,
  Database,
  Trash,
  ArrowClockwise,
  FolderOpen,
  CircleNotch,
} from '@phosphor-icons/react'
import { api, useBackendReady, getBaseUrl, type BackupEntry } from '../api/client'
import { useToast } from '../components/toastStore'
import { dateShort } from '../utils/format'
import './settings.css'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(2)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

const Settings = () => {
  const ready = useBackendReady()
  const toast = useToast()
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [dir, setDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.backups.list()
      setBackups(data.backups)
      setDir(data.dir)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to load backups', { tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const entry = await api.backups.create()
      toast.push(`Backup created (${formatBytes(entry.size)})`)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to create backup', { tone: 'danger' })
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (b: BackupEntry) => {
    if (!window.confirm(`Restore database from "${b.name}"?\nThis replaces all current data.`)) return
    setBusyName(b.name)
    try {
      await api.backups.restore(b.name)
      toast.push('Database restored from backup')
      await load()
      toast.push('Log in again after restore', { tone: 'info' })
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Restore failed', { tone: 'danger' })
    } finally {
      setBusyName(null)
    }
  }

  const handleDelete = async (b: BackupEntry) => {
    if (!window.confirm(`Delete backup "${b.name}"?`)) return
    setBusyName(b.name)
    try {
      await api.backups.delete(b.name)
      toast.push('Backup deleted')
      setBusyName(null)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to delete backup', { tone: 'danger' })
      setBusyName(null)
    }
  }

  return (
    <div className="settings-page">
      <section className="panel settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <span className="settings-icon settings-icon-blue">
              <Database size={16} weight="bold" />
            </span>
            <div>
              <h2>Database backup</h2>
              <p>Snapshots of the clinic database are stored on this computer.</p>
            </div>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary ui-btn-sm"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? <CircleNotch size={13} className="settings-spin" /> : <Archive size={13} weight="bold" />}
            {creating ? 'Creating…' : 'Create backup'}
          </button>
        </div>

        {dir && (
          <div className="settings-location">
            <FolderOpen size={13} />
            <span>{dir}</span>
          </div>
        )}

        <div className="settings-backup-table">
          <div className="settings-bu-row settings-bu-head">
            <span className="bu-name">Name</span>
            <span className="bu-size">Size</span>
            <span className="bu-date">Created</span>
            <span className="bu-actions">Actions</span>
          </div>
          {loading ? (
            <div className="settings-empty">Loading backups…</div>
          ) : backups.length === 0 ? (
            <div className="settings-empty">
              No backups yet. Create your first backup to protect clinic data.
            </div>
          ) : (
            backups.map((b) => {
              const busy = busyName === b.name
              return (
                <div key={b.name} className="settings-bu-row">
                  <span className="bu-name">
                    <CloudArrowUp size={13} color="#64748b" />
                    <span className="bu-name-text" title={b.name}>{b.name}</span>
                  </span>
                  <span className="bu-size">{formatBytes(b.size)}</span>
                  <span className="bu-date">{dateShort(b.createdAt.slice(0, 10))}</span>
                  <span className="bu-actions">
                    <button
                      type="button"
                      className="row-action"
                      title="Restore"
                      disabled={busy}
                      onClick={() => void handleRestore(b)}
                    >
                      {busy ? <CircleNotch size={14} className="settings-spin" /> : <ArrowClockwise size={14} />}
                    </button>
                    <button
                      type="button"
                      className="row-action danger"
                      title="Delete"
                      disabled={busy}
                      onClick={() => void handleDelete(b)}
                    >
                      <Trash size={14} />
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="panel settings-card">
        <div className="settings-card-title">
          <span className="settings-icon settings-icon-teal">
            <Database size={16} weight="bold" />
          </span>
          <div>
            <h2>System information</h2>
            <p>Connection details for this desktop installation.</p>
          </div>
        </div>
        <div className="settings-sys-grid">
          <div><span>Application</span><strong>DCMS · Dental Clinic Management</strong></div>
          <div><span>Backend API</span><strong>{getBaseUrl()}</strong></div>
          <div><span>Backups stored</span><strong>{backups.length}</strong></div>
          <div><span>Status</span><strong className="settings-ok">{ready ? 'Connected' : 'Offline'}</strong></div>
        </div>
      </section>
    </div>
  )
}

export default Settings