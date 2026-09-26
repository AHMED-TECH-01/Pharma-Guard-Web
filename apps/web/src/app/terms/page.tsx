import type { Metadata } from 'next';
import {
  LEGAL_H2_CLASS,
  LEGAL_P_CLASS,
  LEGAL_UL_CLASS,
  LegalPage,
  LEGAL_UPDATED_TERMS,
} from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The terms that govern the use of the PharmaGuard pharmacy expiry, inventory and compliance platform.',
};

/**
 * Terms & Conditions (/terms, public legal page). Generic SaaS terms
 * tailored to PharmaGuard's domain (pharmacy inventory, AI label
 * scanning, professional-responsibility boundaries). Review with counsel
 * before relying on it commercially.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms &amp; Conditions"
      updated={LEGAL_UPDATED_TERMS}
      intro={
        <>
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the
          PharmaGuard web application and related services (the &quot;Service&quot;). By creating an
          account, inviting members to a workspace, or otherwise using the Service, you agree to
          these Terms. If you do not agree, do not use the Service.
        </>
      }
    >
      <h2 className={LEGAL_H2_CLASS}>1. Who these Terms apply to</h2>
      <p className={LEGAL_P_CLASS}>
        PharmaGuard is provided to businesses and professionals - typically pharmacies, and the
        owners, pharmacists and staff they invite into their workspace. The person or organisation
        that creates the workspace (&quot;Owner&quot;) is responsible for the accounts it invites
        and for the activity those accounts perform. If you use the Service on behalf of an
        organisation, you represent that you are authorised to bind that organisation to these
        Terms.
      </p>

      <h2 className={LEGAL_H2_CLASS}>2. What the Service does</h2>
      <p className={LEGAL_P_CLASS}>
        PharmaGuard is a web-based platform that helps pharmacies manage medicine inventory: batch
        and expiry tracking, low-stock and expiry alerts, quarantine handling, supplier and invoice
        records, recall and safety workflows, audit trails, and an AI-assisted scanner that reads
        medicine label images to pre-fill product details. The Service is a tool that supports your
        operations; it does not run your pharmacy for you.
      </p>

      <h2 className={LEGAL_H2_CLASS}>3. Accounts and security</h2>
      <ul className={LEGAL_UL_CLASS}>
        <li>You must provide accurate account information and keep your credentials confidential.</li>
        <li>
          You are responsible for all activity that occurs under your accounts. Notify us
          immediately at support@pharmaguard.app if you suspect unauthorised access.
        </li>
        <li>
          Workspace Owners control member invitations, role assignments and removal of members, and
          remain responsible for managing access to their workspace.
        </li>
      </ul>

      <h2 className={LEGAL_H2_CLASS}>4. Acceptable use</h2>
      <ul className={LEGAL_UL_CLASS}>
        <li>Use the Service only for lawful purposes consistent with applicable pharmacy practice.</li>
        <li>Do not misuse, probe, or attempt to disrupt the Service or access other tenants&apos; data.</li>
        <li>
          Do not upload content that is unlawful, infringing, or unrelated to the operation of your
          pharmacy workspace.
        </li>
        <li>
          Do not resell, sublicense, or provide Service access to third parties outside your
          organisation without our written consent.
        </li>
      </ul>

      <h2 className={LEGAL_H2_CLASS}>5. Professional responsibility and no medical advice</h2>
      <p className={LEGAL_P_CLASS}>
        The Service is not a medical device and does not provide medical, pharmaceutical, or
        regulatory advice. Expiry statuses, alerts, quarantine suggestions, compliance indicators
        and AI-extracted label data are operational aids only. You and your qualified staff remain
        solely responsible for all professional judgements, dispensing decisions, regulatory
        compliance (including DRAP or other applicable authority requirements), and verification of
        any data in the Service before acting on it.
      </p>

      <h2 className={LEGAL_H2_CLASS}>6. AI-assisted label scanning</h2>
      <p className={LEGAL_P_CLASS}>
        The scanner extracts text such as product names, strengths, batch numbers and dates from
        images you upload. Extraction is automated and may be incomplete or inaccurate - for
        example with blurred, damaged, or unusual labels. Every scanned result is presented for
        human review and only becomes inventory data after your staff confirm it. Do not rely on
        unreviewed scan output.
      </p>

      <h2 className={LEGAL_H2_CLASS}>7. Fees and plans</h2>
      <p className={LEGAL_P_CLASS}>
        The Service is currently provided at no charge during its preview period. We may introduce
        paid plans in the future; if we do, we will notify you of pricing and any changes before
        charging applies, and these Terms will be updated accordingly.
      </p>

      <h2 className={LEGAL_H2_CLASS}>8. Availability and changes</h2>
      <p className={LEGAL_P_CLASS}>
        We aim for high availability but do not guarantee uninterrupted or error-free operation. We
        may add, modify, or discontinue features, and may perform maintenance that temporarily
        limits availability. Where a change materially reduces core functionality, we will give
        reasonable notice where practical.
      </p>

      <h2 className={LEGAL_H2_CLASS}>9. Intellectual property</h2>
      <p className={LEGAL_P_CLASS}>
        The Service, including its software, design, and branding, is owned by PharmaGuard or its
        licensors and is protected by intellectual-property laws. You retain all rights to the data
        and content you enter into or upload to your workspace (&quot;Your Data&quot;). You grant
        us the limited right to host, process, and display Your Data solely to operate and support
        the Service for you.
      </p>

      <h2 className={LEGAL_H2_CLASS}>10. Disclaimers</h2>
      <p className={LEGAL_P_CLASS}>
        Except as expressly stated, the Service is provided &quot;as is&quot; and
        &quot;as available&quot; without warranties of any kind, whether express or implied,
        including fitness for a particular purpose, accuracy of AI-extracted data, or
        non-infringement. We do not warrant that alerts or reports will catch every expiry, recall,
        or compliance issue.
      </p>

      <h2 className={LEGAL_H2_CLASS}>11. Limitation of liability</h2>
      <p className={LEGAL_P_CLASS}>
        To the maximum extent permitted by law, PharmaGuard will not be liable for indirect,
        incidental, special, consequential, or punitive damages, or for lost profits, revenue,
        data, or goodwill. Our total aggregate liability relating to the Service will not exceed
        the amount you paid us in the twelve months before the event giving rise to the claim (or,
        if no amounts were paid, one hundred US dollars).
      </p>

      <h2 className={LEGAL_H2_CLASS}>12. Suspension and termination</h2>
      <p className={LEGAL_P_CLASS}>
        You may stop using the Service and close your workspace at any time. We may suspend or
        terminate accounts that breach these Terms, create legal or security risk, or remain
        inactive for an extended period after notice. When a workspace is closed at your request,
        we will make Your Data available for export for a reasonable period and then delete it in
        line with our Privacy Policy.
      </p>

      <h2 className={LEGAL_H2_CLASS}>13. Changes to these Terms</h2>
      <p className={LEGAL_P_CLASS}>
        We may update these Terms from time to time. The &quot;Last updated&quot; date above shows
        the current version. Material changes will be communicated through the Service or by email.
        Continued use of the Service after changes take effect constitutes acceptance of the
        updated Terms.
      </p>

      <h2 className={LEGAL_H2_CLASS}>14. Contact</h2>
      <p className={LEGAL_P_CLASS}>
        Questions about these Terms can be sent to{' '}
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
