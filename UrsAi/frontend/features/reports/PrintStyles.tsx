/**
 * Print-only stylesheet for the Executive Report.
 *
 * Goal: the same report renders cleanly on screen AND on paper
 * (Ctrl+P / Cmd+P from the browser). The on-screen-only
 * chrome — sidebar TOC, Refresh / Print / Download buttons,
 * app sidebar, app navbar — is hidden. Card surfaces switch
 * to a paper-friendly off-white so they don't fight the
 * printer's background-color handling. Section anchors get
 * enough scroll margin to clear the (hidden) navbar.
 *
 * This is a one-component solution: drop <PrintStyles />
 * anywhere in the tree and the @media print rules apply
 * to every descendant.
 *
 * The download-PDF placeholder uses the browser's print
 * dialog (Save as PDF), so these rules also drive the PDF
 * export layout.
 */
export function PrintStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@media print {
  .report-no-print {
    display: none !important;
  }
  body {
    background: #ffffff !important;
  }
  .shadow-soft,
  .shadow-elevated {
    box-shadow: none !important;
  }
  section[id^="report-"] {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 1rem;
  }
  section[id^="report-"] + section[id^="report-"] {
    break-before: auto;
    page-break-before: auto;
  }
  a[href^="#"] {
    color: inherit !important;
    text-decoration: none !important;
  }
  .border-border {
    border-color: #d1d5db !important;
  }
  .bg-secondary\\/30,
  .bg-secondary\\/20,
  .bg-secondary {
    background: #f9fafb !important;
  }
}
        `,
      }}
    />
  );
}
