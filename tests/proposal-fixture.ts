import{defaultProposal as draft}from'../shared/proposal';
// Explicit complete proposal for workflow tests that are not testing incomplete setup.
export function defaultProposal(name:string){return{...draft(name),customerName:'Test Homeowner',customerContact:'homeowner@example.test',scope:'Install 120 linear feet of cedar fencing with one gate and remove jobsite debris.',pricingReviewed:true};}
