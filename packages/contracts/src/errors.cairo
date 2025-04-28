pub mod FUND {
    // POE failed for y = g**x
    pub const F100: felt252 = 'ERROR F100';
}

pub mod WITHDRAW {
    // POE failed for y = g**x
    pub const W100: felt252 = 'ERROR W100';

    // POE failed for CL/g**b = R**x
    pub const W101: felt252 = 'ERROR W101';

    // POE2 failed for V = g**b h**r
    pub const W102: felt252 = 'ERROR W102';

    // POE2 failed for CL/g*b = g**{b0-b} y**r
    pub const W103: felt252 = 'ERROR W103';
}

pub mod TRANSFER {
    // POE failed for y = g**x
    pub const T100: felt252 = 'ERROR T100';

    // POE failed for R = g**r
    pub const T101: felt252 = 'ERROR T101';

    // POE2 failed for L = g**b y**r
    pub const T102: felt252 = 'ERROR T102';

    // POE2 failed for L_bar = g**b y_bar**r
    pub const T103: felt252 = 'ERROR T103';

    // POE2 failed for L_audit = g**b y_audit**r
    pub const T104: felt252 = 'ERROR T104';

    pub const T105: felt252 = 'ERROR T105';

    // POE2 failed for CL/L = b**(b0-b) (CR/R)**x
    pub const T106: felt252 = 'ERROR T106';

    // POE2 failed for V = g**(b0-b) h**r
    pub const T107: felt252 = 'ERROR T107';
}
