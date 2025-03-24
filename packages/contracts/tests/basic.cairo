use tongo::utils::feltXOR;
//use crate::utils::generate_random;

#[test]
fn bitwiseAnd() { 
    let a:u32 = 5;
    let b:u32 = 3;
    let c = a^b;
    assert!(c == 6, "failed");
    assert!(feltXOR(3,5) == 6, "failed");
}

#[test]
fn feltAnd() {
    // a ~ 2**142
    let a = 8321093812093812093821093821374102774388439;
    // b ~ 2 ** 134
    let b = 32749832741092831274107521098431074239213;
    // c = a&b
    let c = 8353678277853599319242955237020937045611578;
    assert!(feltXOR(a,b) == c, "failed");
    assert!(feltXOR(c,a) == b, "failed nilpotency");
}

//#[test]
//fn AndNilpotent() {
//    let seed = 2739182731293;
//    let c1 = generate_random(seed,1);
//    let c = generate_random(seed,2);
//    
//    let c0 = feltXOR(c, c1);
//    assert!(c1 == feltXOR(c0,c), "failed");
//}
