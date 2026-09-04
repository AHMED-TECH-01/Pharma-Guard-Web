import type { Metadata } from 'next';
import UsersPage from './users-page';

export const metadata: Metadata = {
  title: 'Users | PharmaGuard',
};

export default function Users() {
  return <UsersPage />;
}
