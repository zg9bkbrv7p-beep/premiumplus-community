import {test,expect} from '@playwright/test';

test.use({hasTouch:true,viewport:{width:390,height:844}});

test('premium mobile project guide uses real records and opens existing edit controls',async({page,baseURL})=>{
 const origin=baseURL!;
 const reg=await page.request.post('/api/auth/register',{headers:{Origin:origin},data:{name:'Premium QA',company:'Premium QA',email:`premium-ui-${Date.now()}@example.test`,password:'fictional-password-2026'}});
 expect(reg.status()).toBe(201);const csrf=(await reg.json()).csrf;
 const created=await page.request.post('/api/projects',{headers:{Origin:origin,'X-CSRF-Token':csrf},data:{name:'Premium UI QA'}});
 expect(created.status()).toBe(201);const p=await created.json();
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Photo Preview inspiration'})).toContainText('ARCHITECTURAL INSPIRATION');
 await expect(page.locator('.contractor-project-row').filter({hasText:p.name})).toBeVisible();
 await page.locator('.contractor-project-row').filter({hasText:p.name}).click();
 const guide=page.getByRole('region',{name:'Project guide'});
 await expect(guide).toBeVisible();
 await expect(guide).toContainText('1 of 4 milestones');
 await expect(guide).toContainText('Add your property address');
 await expect(guide).toContainText('Milestones reflect saved project records');
 await guide.getByRole('button',{name:'Add your property address'}).click();
 await expect(page.getByLabel('Site address',{exact:true})).toBeVisible();
 await page.getByLabel('Site address',{exact:true}).fill('100 QA Lane');
 await page.getByRole('button',{name:'Save project details',exact:true}).click();
 await expect(guide).toContainText('Prepare the first proposal');
 await guide.getByRole('button',{name:'Prepare the first proposal'}).click();
 await expect(page.getByRole('button',{name:'Create proposal',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
