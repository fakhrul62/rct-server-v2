export const roleCatalog = [
 ['ceo','CEO'],['dgm','DGM'],['hr','HR'],['stl','Sales Team Lead'],
 ['sales_executive','Sales Executive'],['pm','Project Manager'],['executor','Executor'],
] as const;
export const profileFields = {
 id:'internal', employee_code:'internal', name:'public', first_name:'public', last_name:'public', email:'personal', phone:'personal',
 address:'personal', nid:'special_category', birth_date:'personal', photo_ref:'personal',
 emergency_contact_name:'personal', emergency_contact_phone:'personal', joined_on:'internal',
 probation_end_on:'internal', employment_status:'internal', executor_subtype:'internal',
 gross_salary:'compensation', reporting_boss_id:'internal', shift_id:'internal',
} as const;
export const profileEditFields = ['phone','address','emergency_contact_name','emergency_contact_phone'] as const;
