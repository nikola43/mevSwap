import styled from "styled-components"
import wolfbrewtext from "../../assets/images/wolfbrewtext.png"
import wolftea from "../../assets/images/wolftea.gif"

export default function NFTPage() {


  const ImagesContainer = styled.div`{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `

  const MainContainer = styled.div`
  position: absolute;
  left: 48%;
  top: 40%;
  -webkit-transform: translate(-40%, -48%);
  transform: translate(-40%, -48%);
  `

  const WolfteaImage = styled.img`
  width: 100px;
  scale: 2;
  margin-right: 200px;

  @media only screen and (max-device-width: 480px){
    margin-right: 130px;
  }
  `

  const WolfbrewtextImage = styled.img`
  width: 100px;
  scale: 5;
  margin-top: 90px;

  @media only screen and (max-device-width: 480px){
    width: 80px;
    margin-top: 80px;
  }
  `

  return (
    <>
      <MainContainer>
        <br />
        <ImagesContainer>
          <WolfteaImage src={wolftea} alt="wolftea" />
          <WolfbrewtextImage src={wolfbrewtext} alt="wolfbrewtext" />
        </ImagesContainer>
      </MainContainer>
    </>
  )
}
