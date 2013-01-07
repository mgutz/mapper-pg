# FAQ

Q. How to view the SQL being sent to the server?

A. Pass in `verbose` option when connecting.

    Mapper.connect(conn, {verbose: true});


Q. What about migrations?

A. See [mygrate](https://github.com/mgutz/mygrate), an external migration
utility for MySQL and PostgreSQL not tied to an ORM.


