export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: ('ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN')[];
  badge?: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Customer Menu',
    href: '/menu',
    icon: '🍽️',
  },
  {
    label: 'Kitchen KDS',
    href: '/kitchen',
    icon: '👨‍🍳',
    roles: ['ADMIN', 'MANAGER', 'KITCHEN'],
    badge: 'Live',
  },
  {
    label: 'Manager POS',
    href: '/manager',
    icon: '💼',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Admin Suite',
    href: '/admin',
    icon: '👑',
    roles: ['ADMIN'],
  },
];