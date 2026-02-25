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
  'attribute' name=ID ':' type=TypeRef ';';

Member:
  PartDef | PortDef | AttributeDef;

TypeRef:
  type=ID;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w]*/;
