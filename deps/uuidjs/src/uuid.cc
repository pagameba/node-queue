// Copyright (C) 2010 Nikhil Marathe <nsm.nikhil@gmail.com>

#include "uuid.h"

#include <cstring>

using namespace v8;
using namespace node;

extern "C"
void init( Handle<Object> target ) {
  HandleScope scope;
  uuid_v8::Initialize( target );
}

namespace uuid_v8 {

void Initialize( Handle<Object> target ) {
  HandleScope scope;

  Local<FunctionTemplate> t = FunctionTemplate::New(Generate);

  target->Set( String::NewSymbol( "generate" ), t->GetFunction() );
}

Handle<Value> Generate( const Arguments &args ) {
  HandleScope scope;

  uuid_t new_uuid;
  encoding encode = ASCII;
  char unparsed[40];

  if (args.Length() > 0) {
    encode = ParseEncoding(args[0], encode);
  }

  uuid_generate(new_uuid);

  if (encode == BINARY) {
    return Encode(new_uuid, sizeof(uuid_t), encode);
  }
  else {
    uuid_unparse( new_uuid, unparsed );
    return Encode(unparsed, strlen(unparsed), encode);
  }
}

}
