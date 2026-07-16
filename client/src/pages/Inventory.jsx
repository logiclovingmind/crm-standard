import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../api';
import { useAuth } from '../App';

const TYPES = ['1BHK', '2BHK', '3BHK', 'plot', 'villa'];
const UNIT_STATUSES = ['available', 'blocked', 'sold'];

function BrochureCell({ project, canEdit, onError, onChange }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const has = Boolean(project.brochure_filename);

  const upload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return onError(t('inventory.brochurePdfOnly'));
    setBusy(true);
    try {
      await apiUpload(`/inventory/projects/${project.id}/brochure`, file);
      onChange();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/inventory/projects/${project.id}/brochure`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {has && (
        <a href={`/brochures/${project.id}`} target="_blank" rel="noreferrer">
          {project.brochure_filename}
        </a>
      )}
      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files[0])}
          />
          <button className="link" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t('app.loading') : has ? t('inventory.replaceBrochure') : t('inventory.uploadBrochure')}
          </button>
          {has && (
            <button className="link" disabled={busy} onClick={remove}>
              {t('inventory.removeBrochure')}
            </button>
          )}
        </>
      )}
      {!has && !canEdit && <span className="muted">{t('inventory.noBrochure')}</span>}
    </div>
  );
}

export default function Inventory() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const canEdit = me.role === 'owner' || me.role === 'manager';

  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [units, setUnits] = useState([]);
  const [projForm, setProjForm] = useState({ name: '', location: '' });
  const [unitForm, setUnitForm] = useState({ identifier: '', type: '2BHK', area_sqft: '', price: '' });
  const [error, setError] = useState(null);

  const loadProjects = () => api('/inventory/projects').then((d) => setProjects(d.projects));
  const loadUnits = (pid) => api(`/inventory/units?project_id=${pid}`).then((d) => setUnits(d.units));

  useEffect(() => {
    loadProjects().catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) loadUnits(selected.id).catch(console.error);
  }, [selected]);

  const run = (fn) => fn().catch((err) => setError(err.message));

  return (
    <div>
      <h1>{t('inventory.title')}</h1>
      {error && <div className="error">{error}</div>}

      <div className="cards-row">
        <div className="card" style={{ flex: 1 }}>
          <h2>{t('inventory.projects')}</h2>
          {canEdit && (
            <form
              className="form-row"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api('/inventory/projects', { method: 'POST', body: projForm });
                  setProjForm({ name: '', location: '' });
                  loadProjects();
                });
              }}
            >
              <input
                placeholder={t('common.name')}
                value={projForm.name}
                onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                required
              />
              <input
                placeholder={t('inventory.location')}
                value={projForm.location}
                onChange={(e) => setProjForm({ ...projForm, location: e.target.value })}
              />
              <button className="primary">{t('common.add')}</button>
            </form>
          )}
          <table>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="link" onClick={() => setSelected(p)}>
                      {p.name}
                    </button>
                    <div className="muted" style={{ fontSize: 12 }}>{p.location}</div>
                  </td>
                  <td className="muted">
                    {t('inventory.availableCount', { available: p.available_count || 0, total: p.unit_count || 0 })}
                  </td>
                  <td>
                    <BrochureCell project={p} canEdit={canEdit} onError={setError} onChange={loadProjects} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <h2>
            {t('inventory.units')} {selected && `— ${selected.name}`}
          </h2>
          {selected ? (
            <>
              {canEdit && (
                <form
                  className="form-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api('/inventory/units', {
                        method: 'POST',
                        body: {
                          project_id: selected.id,
                          identifier: unitForm.identifier,
                          type: unitForm.type,
                          area_sqft: unitForm.area_sqft ? Number(unitForm.area_sqft) : null,
                          price: unitForm.price ? Number(unitForm.price) : null,
                        },
                      });
                      setUnitForm({ identifier: '', type: '2BHK', area_sqft: '', price: '' });
                      loadUnits(selected.id);
                      loadProjects();
                    });
                  }}
                >
                  <input
                    placeholder={t('inventory.identifier')}
                    value={unitForm.identifier}
                    onChange={(e) => setUnitForm({ ...unitForm, identifier: e.target.value })}
                    required
                    style={{ width: 100 }}
                  />
                  <select value={unitForm.type} onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}>
                    {TYPES.map((tp) => (
                      <option key={tp} value={tp}>{t(`unitType.${tp}`)}</option>
                    ))}
                  </select>
                  <input
                    placeholder={t('inventory.areaSqft')}
                    type="number"
                    value={unitForm.area_sqft}
                    onChange={(e) => setUnitForm({ ...unitForm, area_sqft: e.target.value })}
                    style={{ width: 110 }}
                  />
                  <input
                    placeholder={t('inventory.price')}
                    type="number"
                    value={unitForm.price}
                    onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                    style={{ width: 130 }}
                  />
                  <button className="primary">{t('common.add')}</button>
                </form>
              )}
              <table>
                <thead>
                  <tr>
                    <th>{t('inventory.identifier')}</th>
                    <th>{t('inventory.type')}</th>
                    <th>{t('inventory.areaSqft')}</th>
                    <th>{t('inventory.price')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td>{u.identifier}</td>
                      <td>{t(`unitType.${u.type}`)}</td>
                      <td>{u.area_sqft}</td>
                      <td>{u.price ? `₹${Number(u.price).toLocaleString('en-IN')}` : ''}</td>
                      <td>
                        {canEdit ? (
                          <select
                            value={u.status}
                            onChange={(e) =>
                              run(async () => {
                                await api(`/inventory/units/${u.id}`, { method: 'PUT', body: { status: e.target.value } });
                                loadUnits(selected.id);
                                loadProjects();
                              })
                            }
                          >
                            {UNIT_STATUSES.map((s) => (
                              <option key={s} value={s}>{t(`unitStatus.${s}`)}</option>
                            ))}
                          </select>
                        ) : (
                          t(`unitStatus.${u.status}`)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">{t('app.noResults')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
