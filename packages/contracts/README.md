TODO: 
- Ver como enforcear que el lado derecho de los ciphertext no sean un punto nulo de la curva.
Como el usuario puede mandar el cipher con el random que quiera, podria hacer que el lado derecho sea 0, en ese caso
el izquierdo es g**b y se puede fuerzabrutear. Si no se enforcea, al menos handlear bien ese caso.

- Hacer metodos para los structs que verifiquen que los contenidos esten bien construidos.
- Agregar el amount al struck InputsFund y hacer que ese amount sea parte del challenge
