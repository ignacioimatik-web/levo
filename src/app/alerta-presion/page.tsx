import AlertaPresion from '@/components/alerta-presion/AlertaPresion';

export const metadata = {
  title: 'Alerta Presión | E-nduro Ebiketracks',
  description: 'Calcula la presión óptima de neumáticos para descensos técnicos según tu peso, bici y condiciones meteorológicas en tiempo real.',
  openGraph: {
    title: 'Alerta Presión | E-nduro Ebiketracks',
    description: 'Presión recomendada para descensos técnicos con datos AEMET en tiempo real.',
  },
};

export default function AlertaPresionPage() {
  return <AlertaPresion />;
}
