const express = require('express');
const ExcelJS = require('exceljs');
const { getDb } = require('../db');
const { nowIST } = require('../lib/time');
const { audit } = require('../lib/audit');

// Router is mounted with requireRole('owner') in index.js.
const router = express.Router();

router.get('/leads.xlsx', async (req, res, next) => {
  try {
    const db = getDb();
    audit(req.session.user.id, 'export_leads', 'excel export of all leads');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${nowIST().slice(0, 10)}.xlsx"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Leads');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Source', key: 'source', width: 14 },
      { header: 'Requirement', key: 'requirement', width: 32 },
      { header: 'Assigned To', key: 'assigned_name', width: 20 },
      { header: 'Created', key: 'created_at', width: 26 },
      { header: 'Updated', key: 'updated_at', width: 26 },
      { header: 'Notes Count', key: 'notes_count', width: 12 },
      { header: 'Latest Note', key: 'latest_note', width: 48 },
    ];

    const rows = db
      .prepare(
        `SELECT l.*, u.name AS assigned_name,
                (SELECT COUNT(*) FROM lead_notes n WHERE n.lead_id = l.id) AS notes_count,
                (SELECT body FROM lead_notes n WHERE n.lead_id = l.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note
         FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
         ORDER BY l.id`
      )
      .all();
    for (const row of rows) sheet.addRow(row).commit();
    sheet.commit();
    await workbook.commit();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
