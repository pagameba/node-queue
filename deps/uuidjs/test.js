var uuid = require( "./uuid" )
  , sys = require( "sys" )

for( var i = 0; i < 10; i++ ) {
    // these two are the same
    sys.debug( uuid.generate() );
    sys.debug( uuid.generate('ascii') );
    // don't convert to hex, get the binary string
    sys.debug( uuid.generate('binary') );
    sys.debug( "-------------" );
}

