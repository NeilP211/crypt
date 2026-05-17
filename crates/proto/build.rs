fn main() {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(&["proto/crypt.proto"], &["proto"])
        .expect("failed to compile crypt.proto");
    println!("cargo:rerun-if-changed=proto/crypt.proto");
}
