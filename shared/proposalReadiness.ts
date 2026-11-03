import{calculateTotal,type ProposalData}from'./proposal';
export function proposalReadiness(proposal:Partial<ProposalData>|undefined,address:string){
 const issues:{key:string;message:string}[]=[];
 if(!proposal?.customerName?.trim()||/^(homeowner|customer|client|tbd)$/i.test(proposal.customerName.trim()))issues.push({key:'customerName',message:'Add the homeowner name.'});
 const contact=proposal?.customerContact?.trim()||'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&contact.replace(/\D/g,'').length<7)issues.push({key:'customerContact',message:'Add a homeowner email or phone number.'});
 if(!address.trim())issues.push({key:'address',message:'Add the property address in Edit Details.'});
 const scope=proposal?.scope?.trim()||'';
 if(scope.length<20||/describe (the|your) project|your next chapter|\b(tbd|scope here|placeholder)\b/i.test(scope))issues.push({key:'scope',message:'Replace placeholder scope with the actual work, materials and quantities.'});
 let complete=false;try{complete=!!proposal?.items?.length&&proposal.items.every(i=>i.label.trim().length>0&&i.quantity>0&&i.price>0)&&calculateTotal(proposal.items,proposal.options||[],[])>0;}catch{}
 if(!complete||!proposal?.pricingReviewed)issues.push({key:'pricing',message:'Complete the pricing and confirm it has been checked for this project.'});
 return issues;
}
