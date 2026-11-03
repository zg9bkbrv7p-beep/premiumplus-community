import {test,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,appendFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../../server/db';
import {createBackup,verifyBackup,restoreBackup} from '../../server/backup';
test('live WAL backup verifies, restores privately, revokes sessions, and rejects overwrite/tampering',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'backup-test-')); const db=openDb(join(dir,'live.sqlite'));
 try {db.exec("INSERT INTO companies VALUES('c','Synthetic'); INSERT INTO users VALUES('u','c','Test','test@example.test','hash'); INSERT INTO sessions VALUES('h','u',NULL,'csrf',9999999999999)");
 const dest=join(dir,'backup.sqlite'); await createBackup(db,dest); expect(verifyBackup(dest).version).toBe(1);
 const restored=join(dir,'restored.sqlite'); restoreBackup(dest,restored); const check=openDb(restored);expect(check.prepare('SELECT count(*) n FROM sessions').get()).toEqual({n:0});check.close();
 await expect(createBackup(db,dest)).rejects.toThrow();expect(()=>restoreBackup(dest,restored)).toThrow();
 appendFileSync(dest,'corrupt'); expect(()=>verifyBackup(dest)).toThrow();expect(existsSync(dest+'.manifest.json')).toBe(true);
 }finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
