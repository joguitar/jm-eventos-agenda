import { initializeApp } from "https://gstatic.com";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, orderBy } from "https://gstatic.com";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://gstatic.com";
import { Servico, Empresa, Cliente, ServicoPadrao, Orcamento } from "./models.js";

export class BancoNuvem {
    constructor() {
        const firebaseConfig = {
            apiKey: "AIzaSyBvkQ1GIT0Ip3eOjzYP3GHqQUm9ttQtOIE",
            authDomain: "://firebaseapp.com",
            projectId: "agenda-servico-15464",
            storageBucket: "agenda-servico-15464.firebasestorage.app",
            messagingSenderId: "877748403606",
            appId: "1:877748403606:web:a35126f0fb5d91768731b7",
            measurementId: "G-V0SD6D3F99"
        };

        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        this.auth = getAuth(app);
        this.colecaoRef = collection(this.db, "servicos");
        this.orcamentosRef = collection(this.db, "orcamentos");
        this.clientesRef = collection(this.db, "clientes");
        this.catalogoRef = collection(this.db, "catalogo");
        this.empresaDocRef = doc(this.db, "configuracoes", "empresa");
    }

    obterEmailUsuarioAtual() {
        return this.auth.currentUser ? this.auth.currentUser.email : "Desconhecido";
    }

    monitorarAutenticacao(callback) {
        onAuthStateChanged(this.auth, callback);
    }

    async entrar(email, senha) {
        await signInWithEmailAndPassword(this.auth, email, senha);
    }

    async cadastrar(email, senha) {
        await createUserWithEmailAndPassword(this.auth, email, senha);
    }

    async sair() {
        await signOut(this.auth);
    }

    async salvarEmpresa(empresaObj) {
        await setDoc(this.empresaDocRef, empresaObj.toJSON());
    }

    async carregarEmpresa() {
        const docSnap = await getDoc(this.empresaDocRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            return new Empresa(dados.nome, dados.documento, dados.contato);
        }
        return new Empresa();
    }

    async salvarCliente(clienteObj) {
        await addDoc(this.clientesRef, clienteObj.toJSON());
    }

    async atualizarCliente(clienteObj) {
        await updateDoc(doc(this.db, "clientes", clienteObj.id), clienteObj.toJSON());
    }

    async listarClientes() {
        const q = query(this.clientesRef, orderBy("nome", "asc"));
        const snap = await getDocs(q);
        const lista = [];
        snap.forEach(d => {
            const dados = d.data();
            lista.push(new Cliente(d.id, dados.nome, dados.telefone, dados.endereco));
        });
        return lista;
    }

    async excluirCliente(id) {
        await deleteDoc(doc(this.db, "clientes", id));
    }

    async salvarServicoPadrao(itemObj) {
        await addDoc(this.catalogoRef, itemObj.toJSON());
    }

    async atualizarServicoPadrao(itemObj) {
        await updateDoc(doc(this.db, "catalogo", itemObj.id), itemObj.toJSON());
    }

    async listarCatalogo() {
        const q = query(this.catalogoRef, orderBy("nome", "asc"));
        const snap = await getDocs(q);
        const lista = [];
        snap.forEach(d => {
            const dados = d.data();
            const itensSalvos = dados.itens || (dados.custoEstimado > 0 ? [{ descricao: `Material (${dados.nome})`, valor: dados.custoEstimado }] : []);
            lista.push(new ServicoPadrao(d.id, dados.nome, dados.valorPadrao, dados.garantiaMeses, itensSalvos));
        });
        return lista;
    }

    async excluirServicoPadrao(id) {
        await deleteDoc(doc(this.db, "catalogo", id));
    }

    async salvarOrcamento(orcObj) {
        await addDoc(this.orcamentosRef, orcObj.toJSON());
    }

    async atualizarOrcamento(orcObj) {
        await updateDoc(doc(this.db, "orcamentos", orcObj.id), orcObj.toJSON());
    }

    async listarOrcamentos() {
        const q = query(this.orcamentosRef, orderBy("dataCriacao", "desc"));
        const snap = await getDocs(q);
        const lista = [];
        snap.forEach(d => {
            const dados = d.data();
            lista.push(new Orcamento(
                d.id,
                dados.cliente,
                dados.telefone || "",
                dados.descricao,
                dados.valorCobrado,
                dados.despesas || [],
                dados.status || "Pendente",
                dados.criadoPor || "",
                dados.garantiaMeses !== undefined ? dados.garantiaMeses : 12,
                dados.formaPagamento || "Pix",
                dados.dataCriacao || ""
            ));
        });
        return lista;
    }

    async excluirOrcamento(id) {
        await deleteDoc(doc(this.db, "orcamentos", id));
    }

    async salvarServico(servicoObj) {
        const docRef = await addDoc(this.colecaoRef, servicoObj.toJSON());
        return docRef.id;
    }

    async atualizarServico(servicoObj) {
        const docRef = doc(this.db, "servicos", servicoObj.id);
        await updateDoc(docRef, servicoObj.toJSON());
    }

    async listarAgenda() {
        const querySnapshot = await getDocs(this.colecaoRef);
        const lista = [];

        querySnapshot.forEach((documento) => {
            const dados = documento.data();
            const servico = new Servico(
                documento.id,
                dados.cliente || "Sem Nome",
                dados.descricao || "",
                dados.dataHora || new Date().toISOString().slice(0, 16),
                dados.valorCobrado || 0,
                dados.despesas || [],
                dados.status || "Agendado",
                dados.telefone || "",
                dados.criadoPor || "",
                dados.concluidoPor || "",
                dados.garantiaMeses !== undefined ? dados.garantiaMeses : 12,
                dados.formaPagamento || "Pix"
            );
            lista.push(servico);
        });

        lista.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
        return lista;
    }

    async excluirServico(id) {
        await deleteDoc(doc(this.db, "servicos", id));
    }
}
