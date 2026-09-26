import type { Metadata } from 'next';
import {
  LEGAL_H2_CLASS,
  LEGAL_P_CLASS,
  LEGAL_UL_CLASS,
  LegalPage,
  LEGAL_UPDATED_PRIVACY,
} from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How PharmaGuard collects, uses, and protects the information processed through its pharmacy platform.',
};

/**
 * Privacy Policy (/privacy, public legal page). Describes the data the
 * platform processes and the third-party processors actually in use
 * (Supabase, Vercel, Google Gemini for AI scanning, email delivery).
 * Review with counsel before relying on it commercially.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED_PRIVACY}
      intro={
        <>
          This Privacy Policy explains how PharmaGuard (&quot;we&quot;, &quot;us&quot;) handles
          information processed through the Service. It applies to pharmacy workspace members who
          use the application and to the pharmacy business data entered into it. Your use of the
          Service is also governed by our Terms &amp; Conditions.
        </>
      }
    >
      <h2 className={LEGAL_H2_CLASS}>1. Information we collect</h2>
      <ul className={LEGAL_UL_CLASS}>
        <li>
          <strong className="font-medium text-text">Account information:</strong> your name, work
          email address, role in the workspace, and authentication credentials (managed through our
          authentication provider; passwords are stored only by it, in hashed form).
        </li>
        <li>
          <strong className="font-medium text-text">Workspace data:</strong> the records your
          pharmacy enters or imports - medicines, batches, expiry dates, stock levels, suppliers,
          invoices, quarantine and recall entries, and related notes.
        </li>
        <li>
          <strong className="font-medium text-text">Uploaded images:</strong> photographs of
          medicine packaging or labels that you submit to the AI scanner.
        </li>
        <li>
          <strong className="font-medium text-text">Operational data:</strong> audit-log entries of
          actions taken in a workspace, and technical logs needed to run and secure the Service.
        </li>
      </ul>

      <h2 className={LEGAL_H2_CLASS}>2. How we use information</h2>
      <ul className={LEGAL_UL_CLASS}>
        <li>To provide the Service: accounts, workspaces, inventory records, alerts, and reports.</li>
        <li>To process uploaded label images and pre-fill product details for your review.</li>
        <li>To send transactional email such as confirmation links and password-reset messages.</li>
        <li>To maintain security, prevent abuse, and keep the audit trail your pharmacy relies on.</li>
        <li>To provide support and diagnose problems you report to us.</li>
      </ul>
      <p className={LEGAL_P_CLASS}>
        We do not sell personal information, and we do not use your data for advertising.
      </p>

      <h2 className={LEGAL_H2_CLASS}>3. AI-powered label scanning</h2>
      <p className={LEGAL_P_CLASS}>
        When you use the AI scanner, the uploaded image is sent to Google&apos;s Gemini service
        through our server-side integration to extract text such as product name, strength, batch
        number, and dates. The extraction is returned to your workspace as a draft that your staff
        review and confirm before it becomes inventory data. Images are used solely to produce
        this extraction for your request; we do not use your images or workspace data to train AI
        models.
      </p>

      <h2 className={LEGAL_H2_CLASS}>4. Legal bases</h2>
      <p className={LEGAL_P_CLASS}>
        Where GDPR or similar laws apply, we process account and workspace data to perform our
        contract with the pharmacy (provide the Service), for our legitimate interests in
        operating and securing the platform, and to comply with legal obligations. Where consent
        is required - for example for optional features - we will ask for it.
      </p>

      <h2 className={LEGAL_H2_CLASS}>5. How we share information</h2>
      <p className={LEGAL_P_CLASS}>
        We share data only with the providers needed to operate the Service, under their own
        confidentiality and security obligations:
      </p>
      <ul className={LEGAL_UL_CLASS}>
        <li>
          <strong className="font-medium text-text">Supabase</strong> - managed PostgreSQL
          database, authentication, and storage.
        </li>
        <li>
          <strong className="font-medium text-text">Vercel</strong> - hosting and delivery of the
          web application and API.
        </li>
        <li>
          <strong className="font-medium text-text">Google (Gemini API)</strong> - AI text
          extraction from images you submit for scanning.
        </li>
        <li>
          <strong className="font-medium text-text">Email delivery provider</strong> - transactional
          emails such as account confirmation and password reset.
        </li>
      </ul>
      <p className={LEGAL_P_CLASS}>
        We may also disclose information if required by law, regulation, or valid legal process.
        Workspace members can see the workspace data appropriate to their role; we access workspace
        data only to support you, maintain the Service, or address security or abuse issues.
      </p>

      <h2 className={LEGAL_H2_CLASS}>6. Cookies and local storage</h2>
      <p className={LEGAL_P_CLASS}>
        The Service uses strictly necessary, HttpOnly session cookies to keep you signed in, and a
        small local-storage entry to remember your appearance preferences. We do not use
        advertising or third-party tracking cookies.
      </p>

      <h2 className={LEGAL_H2_CLASS}>7. Data retention and deletion</h2>
      <p className={LEGAL_P_CLASS}>
        Workspace data is retained while your workspace is active. When a workspace is closed or
        deletion is requested, we delete the workspace data within a reasonable operational window
        (up to 30 days), except where longer retention is required by law or for legitimate
        record-keeping (for example audit logs). Backup copies age out in line with our backup
        schedule.
      </p>

      <h2 className={LEGAL_H2_CLASS}>8. Security</h2>
      <p className={LEGAL_P_CLASS}>
        We protect data with encryption in transit, role-based access control, strict
        tenant isolation between pharmacies, and least-privilege access for our own staff. No
        system is perfectly secure; if a data incident affects your workspace, we will notify you
        where required by law.
      </p>

      <h2 className={LEGAL_H2_CLASS}>9. Your rights</h2>
      <p className={LEGAL_P_CLASS}>
        Subject to applicable law, you may request access to, correction of, or deletion of your
        personal information, object to or restrict certain processing, or receive a portable copy
        of data you contributed. Workspace Owners can manage and export workspace data from the
        application. To exercise a right, contact us at{' '}
        <a
          href="mailto:support@pharmaguard.app"
          className="font-medium text-primary-700 underline decoration-border underline-offset-2 hover:text-primary-800"
        >
          support@pharmaguard.app
        </a>
        ; we will verify the request before acting on it.
      </p>

      <h2 className={LEGAL_H2_CLASS}>10. International transfers</h2>
      <p className={LEGAL_P_CLASS}>
        Our providers may process data in countries other than your own. Where required, we rely
        on the safeguards those providers offer (such as standard contractual clauses) to transfer
        data lawfully.
      </p>

      <h2 className={LEGAL_H2_CLASS}>11. Children</h2>
      <p className={LEGAL_P_CLASS}>
        The Service is a business tool for pharmacy professionals and is not directed to children
        under 18. We do not knowingly collect personal information from children.
      </p>

      <h2 className={LEGAL_H2_CLASS}>12. Changes to this policy</h2>
      <p className={LEGAL_P_CLASS}>
        We may update this Privacy Policy as the Service evolves. The &quot;Last updated&quot;
        date above shows the current version, and material changes will be communicated through
        the Service or by email.
      </p>

      <h2 className={LEGAL_H2_CLASS}>13. Contact</h2>
      <p className={LEGAL_P_CLASS}>
        Privacy questions and requests can be sent to{' '}
        <a
          href="mailto:support@pharmaguard.app"
          className="font-medium text-primary-700 underline decoration-border underline-offset-2 hover:text-primary-800"
        >
          support@pharmaguard.app
        </a>
        .
      </p>
    </LegalPage>
  );
}
