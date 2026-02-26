grammar SysML

entry Model:
  (elements+=ModelElement)*;

ModelElement:
  Package | PartDef | PortDef | AttributeDef;

Package:
  'package' name=ID '{'
    (elements+=ModelElement)*
  '}';

PartDef:
  'part' 'def' name=ID '{'
    (members+=Member)*
  '}';

PortDef:
  'port' 'def' name=ID (';' | '{' (members+=Member)* '}');

AttributeDef:
  direction=Direction? 'attribute' name=ID ':' type=TypeRef ';';

Member:
  PartDef | PortDef | AttributeDef | PartUsage | PortUsage;

PartUsage:
  'part' name=ID ':' type=TypeRef ';';

PortUsage:
  'port' name=ID ':' type=TypeRef ';';

TypeRef:
  type=ID ('[' INT ']')?;

Direction returns string:
  'in' | 'out';

hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w]*/;
terminal INT: /[0-9]+/;
