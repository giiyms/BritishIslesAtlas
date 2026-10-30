/** Canonical party labels and colours shared by results, projections and tactical picks. */
export function canonicalParty(name: string, code = ''): string {
  if (/^Nationalist$/i.test(name)) return code.startsWith('S') ? 'SNP' : code.startsWith('W') ? 'Plaid Cymru' : 'Nationalist';
  if (/^Minor$/i.test(name)) return 'Other';
  if (/^(Lab|Labour)$/i.test(name)) return 'Labour';
  if (/^(Con|Conservative)$/i.test(name)) return 'Conservative';
  if (/^(LD|Liberal Democrat.*)$/i.test(name)) return 'Liberal Democrat';
  if (/^(RUK|Reform.*)$/i.test(name)) return 'Reform UK';
  if (/^(RB|Restore Britain)$/i.test(name)) return 'Restore Britain';
  if (/^(?:the )?green(?: party)?$/i.test(name)) return 'Green';
  if (/^(SNP|Scottish National.*)$/i.test(name)) return 'SNP';
  if (/plaid/i.test(name)) return 'Plaid Cymru';
  return name;
}
const colours: Record<string,string> = { Labour:'#d83b40', Conservative:'#3478bf', 'Liberal Democrat':'#eea832', 'Reform UK':'#19a8b4', Green:'#4a9a59', SNP:'#e7ca36', 'Plaid Cymru':'#6eae80', Independent:'#9169a6', Speaker:'#806d5d', Other:'#937d9c', 'Restore Britain':'#344b70' };
export function partyColour(party: string): string { return colours[canonicalParty(party)] ?? (party ? '#937d9c' : '#b9bec4'); }
