// Small synthetic clipboard fixture owned by this MIT-licensed project.
const id = n => n.toString(16).padStart(32, '0').toUpperCase();
const pin = (n, name, output, links = '', type = 'exec', extra = '') =>
  `   CustomProperties Pin (PinId=${id(n)},PinName="${name}",${output ? 'Direction="EGPD_Output",' : ''}PinType.PinCategory="${type}",${links ? `LinkedTo=(${links},),` : ''}${extra})`;
const node = (name, cls, props, pins) => `Begin Object Class=/Script/BlueprintGraph.${cls} Name="${name}"\n${props}\n${pins.join('\n')}\nEnd Object`;
export const example = [
  node('Event_0', 'K2Node_Event', '   EventReference=(MemberName="ReceiveBeginPlay")', [pin(1, 'then', true, `Branch_0 ${id(2)}`)]),
  node('Branch_0', 'K2Node_IfThenElse', '', [pin(2, 'execute', false, `Event_0 ${id(1)}`), pin(3, 'then', true, `Print_0 ${id(6)}`), pin(4, 'else', true, `Print_0 ${id(6)}`), pin(5, 'Condition', false, '', 'bool', 'DefaultValue="true",')]),
  node('Print_0', 'K2Node_CallFunction', '   FunctionReference=(MemberName="PrintString")', [pin(6, 'execute', false, `Branch_0 ${id(3)},Branch_0 ${id(4)}`), pin(7, 'InString', false, '', 'string', 'DefaultValue="Hello from Blueprint Reader",')]),
].join('\n');
