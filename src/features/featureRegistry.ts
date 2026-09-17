export type FeatureStatus =
  | 'READY'
  | 'BETA'
  | 'ADMIN_ONLY'
  | 'DEVELOPER_ONLY'
  | 'COMING_SOON'
  | 'DISABLED';

export interface FeatureDefinition {
  featureId: string;
  displayName: {
    en: string;
    ar: string;
  };
  status: FeatureStatus;
  enabledByDefault: boolean;
  visibleToRoles?: string[];
  requiredVerticals?: string[];
  requiredDependencies?: string[];
  route: string;
  navigationGroup: 'Workspace' | 'Sales' | 'Purchases' | 'Inventory' | 'Finance' | 'Operations' | 'Reports' | 'Administration';
  module: string;
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  { featureId: 'dashboard', displayName: { en: 'Overview', ar: 'نظرة عامة' }, status: 'READY', enabledByDefault: true, route: 'dashboard', navigationGroup: 'Workspace', module: 'dashboard' },
  { featureId: 'sales', displayName: { en: 'Sales', ar: 'المبيعات' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Sales Lead', 'Finance Manager', 'VP Finance', 'Management'], route: 'sales', navigationGroup: 'Sales', module: 'sales' },
  { featureId: 'pos', displayName: { en: 'POS', ar: 'نقطة البيع' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Sales Lead', 'Management'], route: 'pos', navigationGroup: 'Sales', module: 'pos' },
  { featureId: 'purchasing', displayName: { en: 'Purchasing', ar: 'المشتريات' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Purchasing Agent', 'Buyer', 'Procurement Manager', 'Management'], route: 'purchasing', navigationGroup: 'Purchases', module: 'purchasing' },
  { featureId: 'inventory', displayName: { en: 'Inventory', ar: 'المخزون' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Inventory Manager', 'Warehouse', 'Purchasing Agent', 'Management'], route: 'inventory', navigationGroup: 'Inventory', module: 'inventory' },
  { featureId: 'accounting', displayName: { en: 'Finance', ar: 'المالية' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Finance Manager', 'VP Finance', 'Management'], route: 'accounting', navigationGroup: 'Finance', module: 'accounting' },
  { featureId: 'banking', displayName: { en: 'Cash & Bank', ar: 'النقد والبنك' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Finance Manager', 'VP Finance', 'Management'], route: 'banking', navigationGroup: 'Finance', module: 'banking' },
  { featureId: 'fixed_assets', displayName: { en: 'Fixed Assets', ar: 'الأصول الثابتة' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Finance Manager', 'VP Finance', 'Management'], route: 'fixed_assets', navigationGroup: 'Finance', module: 'fixed_assets' },
  { featureId: 'bi_analytics', displayName: { en: 'Business Insights', ar: 'التحليلات' }, status: 'READY', enabledByDefault: true, route: 'bi_analytics', navigationGroup: 'Reports', module: 'bi_analytics' },
  { featureId: 'reports', displayName: { en: 'Reports', ar: 'التقارير' }, status: 'READY', enabledByDefault: true, route: 'reports', navigationGroup: 'Reports', module: 'reports' },
  { featureId: 'manufacturing', displayName: { en: 'Manufacturing', ar: 'التصنيع' }, status: 'READY', enabledByDefault: false, requiredVerticals: ['GARMENT_MANUFACTURING'], route: 'manufacturing', navigationGroup: 'Operations', module: 'manufacturing' },
  { featureId: 'crm', displayName: { en: 'Customers', ar: 'العملاء' }, status: 'READY', enabledByDefault: true, route: 'crm', navigationGroup: 'Sales', module: 'crm' },
  { featureId: 'hr', displayName: { en: 'People', ar: 'الموظفون' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'HR Specialist', 'Management'], route: 'hr', navigationGroup: 'Administration', module: 'hr' },
  { featureId: 'workflows', displayName: { en: 'Approvals', ar: 'الموافقات' }, status: 'READY', enabledByDefault: true, visibleToRoles: ['Super Admin', 'Approver', 'Management'], route: 'workflows', navigationGroup: 'Administration', module: 'workflows' },
  { featureId: 'users_security', displayName: { en: 'Users & Roles', ar: 'المستخدمون والأدوار' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'users_security', navigationGroup: 'Administration', module: 'users_security' },
  { featureId: 'audit_center', displayName: { en: 'Audit Log', ar: 'سجل التدقيق' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'audit_center', navigationGroup: 'Administration', module: 'audit_center' },
  { featureId: 'settings', displayName: { en: 'Tax & Accounting Settings', ar: 'إعدادات الضرائب والمحاسبة' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'settings', navigationGroup: 'Administration', module: 'settings' },
  { featureId: 'master_data', displayName: { en: 'Master Data', ar: 'البيانات الأساسية' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'master_data', navigationGroup: 'Administration', module: 'master_data' },
  { featureId: 'branding', displayName: { en: 'Branding', ar: 'الهوية' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'branding', navigationGroup: 'Administration', module: 'branding' },
  { featureId: 'onboarding_wizard', displayName: { en: 'Setup', ar: 'الإعداد' }, status: 'ADMIN_ONLY', enabledByDefault: true, route: 'onboarding_wizard', navigationGroup: 'Administration', module: 'onboarding_wizard' },
  { featureId: 'ai', displayName: { en: 'AI Assistant', ar: 'المساعد الذكي' }, status: 'BETA', enabledByDefault: false, route: 'ai', navigationGroup: 'Workspace', module: 'ai' },
  { featureId: 'platform_readiness', displayName: { en: 'Platform Readiness', ar: 'جاهزية المنصة' }, status: 'DEVELOPER_ONLY', enabledByDefault: false, route: 'platform_readiness', navigationGroup: 'Administration', module: 'platform_readiness' },
  { featureId: 'core', displayName: { en: 'Configuration', ar: 'الإعدادات' }, status: 'DEVELOPER_ONLY', enabledByDefault: false, route: 'core', navigationGroup: 'Administration', module: 'core' },
  { featureId: 'documents', displayName: { en: 'Documents', ar: 'المستندات' }, status: 'COMING_SOON', enabledByDefault: false, route: 'documents', navigationGroup: 'Reports', module: 'documents' },
  { featureId: 'projects', displayName: { en: 'Projects', ar: 'المشروعات' }, status: 'COMING_SOON', enabledByDefault: false, route: 'projects', navigationGroup: 'Operations', module: 'projects' },
  { featureId: 'customer_display', displayName: { en: 'Customer Display', ar: 'عرض الزبائن' }, status: 'COMING_SOON', enabledByDefault: false, route: 'customer_display', navigationGroup: 'Sales', module: 'customer_display' }
];

export function getVisibleFeatures(role?: string, vertical?: string): FeatureDefinition[] {
  const normalizedRole = role || 'Super Admin';
  const normalizedVertical = (vertical || '').toUpperCase();

  return FEATURE_REGISTRY.filter(feature => {
    if (feature.status === 'DISABLED') return false;
    if (feature.status === 'DEVELOPER_ONLY') return false;
    if (feature.status === 'COMING_SOON') return false;
    if (feature.status === 'BETA') return false;
    if (feature.status === 'ADMIN_ONLY') {
      return ['Super Admin', 'Tenant Admin'].includes(normalizedRole);
    }
    if (feature.requiredVerticals?.length) {
      return feature.requiredVerticals.includes(normalizedVertical);
    }
    if (feature.visibleToRoles?.length) {
      return feature.visibleToRoles.includes(normalizedRole);
    }
    return feature.enabledByDefault;
  });
}
