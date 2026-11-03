import {DatabaseSync} from 'node:sqlite';
import {createBackup,verifyBackup,restoreBackup} from '../server/backup';
const [action,source,destination]=process.argv.slice(2);
try{if(action==='--create'&&source&&destination){const db=new DatabaseSync(source,{readOnly:true,allowExtension:false});try{await createBackup(db,destination);}finally{db.close();}}else if(action==='--verify'&&source&&!destination){verifyBackup(source);}else if(action==='--restore'&&source&&destination){restoreBackup(source,destination);}else throw Error('Usage: --create source destination | --verify backup | --restore backup new-destination');console.log('Backup operation completed.');}catch(e){console.error(e instanceof Error?e.message:'Backup operation failed');process.exitCode=1;}
